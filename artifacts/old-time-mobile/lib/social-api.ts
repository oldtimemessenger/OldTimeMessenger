export type SocialUser = {
  id: number;
  name: string;
  username: string;
};

export type SocialPost = {
  id: number;
  kind: 'text' | 'photo' | 'video' | 'link' | 'news';
  content: string;
  visibility: 'public' | 'friends' | 'followers' | 'private';
  media: Array<{
    type: 'image' | 'video';
    objectPath: string;
    mimeType: string;
    width?: number;
    height?: number;
    duration?: number;
  }>;
  linkUrl: string | null;
  linkTitle: string | null;
  linkDescription: string | null;
  linkImageUrl: string | null;
  news: { source: string; publishedAt: number | null; url: string } | null;
  createdAt: number;
  updatedAt: number;
  author: SocialUser;
  counts: { likes: number; comments: number; reposts: number; saves: number };
  viewer: {
    liked: boolean;
    reposted: boolean;
    saved: boolean;
    followingAuthor: boolean;
  };
};

export type SocialComment = {
  id: number;
  postId: number;
  authorId: number;
  parentId: number | null;
  content: string;
  createdAt: number;
  author: SocialUser;
  liked: boolean;
};

export type UserCard = SocialUser & {
  followerCount: number;
  followingCount: number;
  following: boolean;
  muted: boolean;
  canMessage: boolean;
};

export type FeedPage = {
  mode: 'for-you' | 'following';
  items: SocialPost[];
  nextCursor: number | null;
};

export type SearchResults = {
  users: SocialUser[];
  posts: SocialPost[];
};

function baseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : '';
}

async function request<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && typeof data.error === 'string'
        ? data.error
        : 'The request could not be completed.';
    throw new Error(message);
  }
  return data as T;
}

export function socialMediaUrl(objectPath: string): string {
  return `${baseUrl()}/api/storage${objectPath}`;
}

export function getSocialFeed(
  token: string,
  mode: 'for-you' | 'following',
  cursor?: number | null,
) {
  const query = new URLSearchParams({ mode, limit: '20' });
  if (cursor) query.set('cursor', String(cursor));
  return request<FeedPage>(token, `/api/social/feed?${query.toString()}`);
}

export function createSocialPost(
  token: string,
  input: {
    content: string;
    visibility: SocialPost['visibility'];
    kind?: SocialPost['kind'];
    linkUrl?: string | null;
  },
) {
  return request<SocialPost>(token, '/api/social/posts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function setPostRelation(
  token: string,
  postId: number,
  relation: 'like' | 'repost' | 'save',
  active: boolean,
) {
  return request<{ success: boolean; active: boolean }>(
    token,
    `/api/social/posts/${postId}/${relation}`,
    { method: active ? 'PUT' : 'DELETE' },
  );
}

export function getPostComments(token: string, postId: number) {
  return request<SocialComment[]>(token, `/api/social/posts/${postId}/comments`);
}

export function createPostComment(
  token: string,
  postId: number,
  content: string,
  parentId?: number | null,
) {
  return request<SocialComment>(token, `/api/social/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content, parentId: parentId ?? null }),
  });
}

export function deletePostComment(token: string, commentId: number) {
  return request<{ success: boolean }>(token, `/api/social/comments/${commentId}`, {
    method: 'DELETE',
  });
}

export function setCommentLike(
  token: string,
  commentId: number,
  active: boolean,
) {
  return request<{ success: boolean; active: boolean }>(
    token,
    `/api/social/comments/${commentId}/like`,
    { method: active ? 'PUT' : 'DELETE' },
  );
}

export function setFollowing(
  token: string,
  userId: number,
  active: boolean,
) {
  return request<{ success: boolean; following: boolean }>(
    token,
    `/api/social/users/${userId}/follow`,
    { method: active ? 'PUT' : 'DELETE' },
  );
}

export function getUserCard(token: string, userId: number) {
  return request<UserCard>(token, `/api/social/users/${userId}/card`);
}

export function setUserBlocked(token: string, userId: number, active: boolean) {
  return request<{ success: boolean; blocked: boolean }>(
    token,
    `/api/social/users/${userId}/block`,
    { method: active ? 'PUT' : 'DELETE' },
  );
}

export function setUserMuted(token: string, userId: number, active: boolean) {
  return request<{ success: boolean; muted: boolean }>(
    token,
    `/api/social/users/${userId}/mute`,
    { method: active ? 'PUT' : 'DELETE' },
  );
}

export function reportSocialContent(
  token: string,
  input: {
    targetType: 'post' | 'comment' | 'user';
    targetId: number;
    reason:
      | 'spam'
      | 'harassment'
      | 'hate'
      | 'violence'
      | 'sexual_content'
      | 'misinformation'
      | 'copyright'
      | 'other';
    details?: string;
  },
) {
  return request<{ success: boolean }>(token, '/api/social/reports', {
    method: 'POST',
    body: JSON.stringify({ ...input, details: input.details ?? '' }),
  });
}

export function searchSocial(token: string, query: string) {
  return request<SearchResults>(
    token,
    `/api/social/users/search?q=${encodeURIComponent(query)}`,
  );
}