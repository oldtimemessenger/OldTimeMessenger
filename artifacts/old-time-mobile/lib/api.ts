import { setAuthTokenGetter, setBaseUrl } from '@/lib/api-client-react';
import {
  setAuthTokenGetter as setWorkspaceAuthTokenGetter,
  setBaseUrl as setWorkspaceBaseUrl,
  setUnauthorizedHandler as setWorkspaceUnauthorizedHandler,
} from '@workspace/api-client-react';
import * as FileSystem from 'expo-file-system/legacy';

const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
const devDomain = process.env.EXPO_PUBLIC_DOMAIN;

const resolvedApiBaseUrl =
  (__DEV__ && devDomain ? `https://${devDomain}` : undefined) ??
  configuredUrl ??
  (devDomain ? `https://${devDomain}` : undefined);

export const API_CONFIGURED = Boolean(resolvedApiBaseUrl);
const clientApiBaseUrl = resolvedApiBaseUrl ?? 'https://old-time.invalid';

export const API_BASE_URL = clientApiBaseUrl;

export type AuthTokenGetter = (forceRefresh?: boolean) => Promise<string | null>;

export function configureApi(getToken: AuthTokenGetter) {
  setBaseUrl(API_BASE_URL);
  setAuthTokenGetter(getToken);
  setWorkspaceBaseUrl(API_BASE_URL);
  setWorkspaceAuthTokenGetter(getToken);
  setWorkspaceUnauthorizedHandler(async () => {
    await getToken(true);
  });
}

type MediaType = 'image' | 'video' | 'document';

type UploadMediaInput = {
  uri: string;
  mediaType: MediaType;
  name: string;
  contentType: string;
  size?: number;
  getToken: AuthTokenGetter;
};

type UploadMediaResponse = {
  uploadURL: string;
  objectPath: string;
};

function absoluteApiUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

async function authenticatedFetch(path: string, getToken: AuthTokenGetter, init?: RequestInit) {
  if (!API_CONFIGURED) {
    throw new Error('Old Time API is not configured for this build. Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_DOMAIN.');
  }
  let response: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await getToken(attempt > 0);
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (response.status !== 401 || attempt === 1) break;
  }
  if (!response) throw new Error('Media request failed.');
  if (!response.ok) {
    let message = 'Media request failed.';
    try {
      const payload = (await response.json()) as { message?: string; error?: string };
      if (payload.message || payload.error) message = payload.message ?? payload.error ?? message;
    } catch {
      // Keep the generic message when the server did not return JSON.
    }
    throw new Error(message);
  }
  return response;
}

export async function uploadMedia(input: UploadMediaInput): Promise<string> {
  let objectPath: string | null = null;
  try {
    const fileInfo = input.size
      ? null
      : await FileSystem.getInfoAsync(input.uri);
    const size = input.size ?? (fileInfo && fileInfo.exists && 'size' in fileInfo && typeof fileInfo.size === 'number' ? fileInfo.size : undefined);
    if (!size) throw new Error('Could not determine the media file size.');

    const response = await authenticatedFetch('/api/storage/uploads/request-url', input.getToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        size,
        contentType: input.contentType,
        mediaType: input.mediaType,
      }),
    });
    const prepared = (await response.json()) as UploadMediaResponse;
    objectPath = prepared.objectPath;

    let upload: Awaited<ReturnType<typeof FileSystem.uploadAsync>> | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await input.getToken(attempt > 0);
      upload = await FileSystem.uploadAsync(absoluteApiUrl(prepared.uploadURL), input.uri, {
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        httpMethod: 'PUT',
        headers: {
          'Content-Type': input.contentType,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (upload.status !== 401 || attempt === 1) break;
    }
    if (!upload) throw new Error('The media upload did not start.');
    if (upload.status < 200 || upload.status >= 300) {
      throw new Error('The media upload did not complete.');
    }
    return prepared.objectPath;
  } catch (error) {
    if (objectPath) await cleanupMediaUpload(objectPath, input.getToken);
    throw error;
  }
}

export type SocialPostInput = {
  content: string;
  kind: 'text' | 'photo' | 'video';
  visibility?: 'public' | 'friends' | 'followers' | 'private';
  allowReposts?: boolean;
  media?: Array<{
    type: 'image' | 'video';
    objectPath: string;
    mimeType: string;
    width?: number;
    height?: number;
    duration?: number;
  }>;
};

export async function createSocialPost(input: SocialPostInput, getToken: AuthTokenGetter) {
  const response = await authenticatedFetch('/api/social/posts', getToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return response.json() as Promise<{ id: string | number }>;
}

export async function attachPostToHubs(
  postId: string | number,
  hubIds: number[],
  getToken: AuthTokenGetter,
) {
  const response = await authenticatedFetch(`/api/social/posts/${encodeURIComponent(String(postId))}/hubs`, getToken, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hubIds }),
  });
  return response.json();
}

export async function updateProfileAvatar(input: { userId: string; objectPath: string; getToken: AuthTokenGetter }) {
  const response = await authenticatedFetch(`/api/users/${encodeURIComponent(input.userId)}/profile`, input.getToken, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarObjectPath: input.objectPath }),
  });
  return response.json();
}

export async function createStory(input: {
  content?: string;
  visibility?: 'public' | 'friends' | 'followers' | 'close_friends' | 'private';
  media?: {
    type: 'image' | 'video';
    objectPath: string;
    mimeType: string;
    width?: number;
    height?: number;
    duration?: number;
    fit?: 'contain' | 'cover';
  } | null;
}, getToken: AuthTokenGetter) {
  const response = await authenticatedFetch('/api/social/stories', getToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return response.json();
}

export async function cleanupMediaUpload(objectPath: string, getToken: AuthTokenGetter) {
  if (!objectPath.startsWith('/objects/uploads/')) return;
  await authenticatedFetch(`/api/storage/objects/${objectPath.slice('/objects/'.length)}`, getToken, {
    method: 'DELETE',
  }).catch(() => undefined);
}

export function resolveRemoteMediaUrl(mediaUrl: string): string {
  if (/^https?:\/\//i.test(mediaUrl)) return mediaUrl;
  if (!API_CONFIGURED) return mediaUrl;
  return `${API_BASE_URL}${mediaUrl.startsWith('/') ? mediaUrl : `/api/storage/objects/${mediaUrl}`}`;
}