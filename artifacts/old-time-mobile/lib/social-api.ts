import { apiBaseUrl } from '@/lib/api-base-url';

export type SocialUser = {
  id: number;
  name: string;
  username: string;
  bio?: string;
};

export type SocialPost = {
  id: number;
  kind: 'text' | 'photo' | 'video' | 'link' | 'news';
  content: string;
  visibility: 'public' | 'friends' | 'followers' | 'private';
  allowReposts: boolean;
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

export type ContactPermission = 'everyone' | 'followers' | 'nobody';
export type MessageRequest = {
  id: number;
  sender: SocialUser;
  recipient: SocialUser;
  status: 'pending' | 'accepted' | 'declined';
  chatId: number | null;
  createdAt: number;
  updatedAt: number;
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
export type Story = {
  id: number; kind: 'text' | 'image' | 'video'; content: string;
  visibility: 'public' | 'friends' | 'followers' | 'close_friends' | 'private';
  media: { type: 'image' | 'video'; objectPath: string; mimeType: string; width?: number; height?: number; duration?: number; fit?: 'contain' | 'cover' } | null;
  createdAt: number; expiresAt: number; location: { latitude: number; longitude: number } | null; author: SocialUser;
  viewer: { viewed: boolean; isOwner: boolean }; counts: { views: number; reactions: number };
};
export type SocialNotification = {
  id: number;
  recipientId: number;
  actorId: number;
  type: string;
  storyId: number | null;
  replyId: number | null;
  createdAt: number;
  readAt: number | null;
  actor: SocialUser;
};

function baseUrl(): string {
  return apiBaseUrl();
}

async function request<T>(
  token: string | null,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    allowReposts?: boolean;
    kind?: SocialPost['kind'];
    media?: SocialPost['media'];
    linkUrl?: string | null;
    linkTitle?: string | null;
    linkDescription?: string | null;
    linkImageUrl?: string | null;
  },
) {
  return request<SocialPost>(token, '/api/social/posts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function setPresencePrivacy(token: string, userId: number, lastSeenVisible: boolean) {
  return request<{ success: boolean; lastSeenVisible: boolean }>(
    token,
    `/api/users/${userId}/presence-privacy`,
    { method: 'PUT', body: JSON.stringify({ lastSeenVisible }) },
  );
}

export function setPresence(token: string, userId: number, online: boolean) {
  return request<{ success: boolean; online: boolean; lastSeen: number }>(
    token,
    `/api/users/${userId}/presence`,
    { method: 'PUT', body: JSON.stringify({ online }) },
  );
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

export function getUserPosts(token: string, userId: number) {
  return request<{ items: SocialPost[] }>(token, `/api/social/users/${userId}/posts?limit=30`);
}

export function updateUserProfile(
  token: string,
  userId: number,
  input: { name?: string; username?: string; bio?: string; birthday?: string; contactPermission?: ContactPermission },
) {
  return request<{
    id: number;
    phone: string;
    name: string;
    username: string;
    bio: string;
    birthday: string | null;
    contactPermission: ContactPermission;
    online: boolean;
    lastSeen: number;
    lastSeenVisible: boolean;
  }>(token, `/api/users/${userId}/profile`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function completeBirthday(challengeId: string, birthday: string) {
  return request<{
    id: number;
    phone: string;
    name: string;
    username: string;
    bio: string;
    birthday: string | null;
    contactPermission: ContactPermission;
    online: boolean;
    lastSeen: number;
    lastSeenVisible: boolean;
    authToken: string;
  }>(null, '/api/auth/complete-birthday', {
    method: 'POST',
    body: JSON.stringify({ challengeId, birthday }),
  });
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

export function createMessageRequest(token: string, userId: number) {
  return request<MessageRequest>(token, `/api/social/message-requests/to/${userId}`, {
    method: 'POST',
  });
}

export function getMessageRequests(token: string, box: 'incoming' | 'outgoing' = 'incoming') {
  return request<{ items: MessageRequest[] }>(
    token,
    `/api/social/message-requests?box=${box}`,
  );
}

export function acceptMessageRequest(token: string, requestId: number) {
  return request<{ success: boolean; chatId: number }>(
    token,
    `/api/social/message-requests/${requestId}/accept`,
    { method: 'PUT' },
  );
}

export function declineMessageRequest(token: string, requestId: number) {
  return request<{ success: boolean }>(
    token,
    `/api/social/message-requests/${requestId}`,
    { method: 'DELETE' },
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
export function getStories(token: string) { return request<{ items: Story[] }>(token, '/api/social/stories'); }
export function getNearbyStories(token: string, latitude: number, longitude: number, radiusKm = 5, limit = 60) {
  return request<{ items: Story[] }>(token, `/api/social/stories/nearby?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&radiusKm=${encodeURIComponent(radiusKm)}&limit=${encodeURIComponent(limit)}`);
}
export function createStory(token: string, input: { content: string; visibility: Story['visibility']; media?: Story['media']; location?: { latitude: number; longitude: number } | null }) {
  return request<Story>(token, '/api/social/stories', { method: 'POST', body: JSON.stringify(input) });
}
export function viewStory(token: string, storyId: number) { return request<{ success: boolean }>(token, `/api/social/stories/${storyId}/view`, { method: 'PUT' }); }
export function reactToStory(token: string, storyId: number, reaction: string) { return request<{ success: boolean }>(token, `/api/social/stories/${storyId}/reaction`, { method: 'PUT', body: JSON.stringify({ reaction }) }); }
export function replyToStory(token: string, storyId: number, content: string) { return request<{ id: number }>(token, `/api/social/stories/${storyId}/replies`, { method: 'POST', body: JSON.stringify({ content }) }); }
export function getStoryViewers(token: string, storyId: number) { return request<{ items: Array<SocialUser & { viewedAt: number }> }>(token, `/api/social/stories/${storyId}/viewers`); }
export function getSocialNotifications(token: string) {
  return request<{ items: SocialNotification[] }>(token, '/api/social/notifications?limit=30');
}
export function markSocialNotificationRead(token: string, notificationId: number) {
  return request<{ success: boolean }>(token, `/api/social/notifications/${notificationId}/read`, { method: 'PUT' });
}
export function getSharingExclusions(token: string) {
  return request<{ items: SocialUser[] }>(token, '/api/social/privacy/exclusions');
}
export function setSharingExcluded(token: string, userId: number, active: boolean) {
  return request<{ active: boolean }>(token, `/api/social/privacy/exclusions/${userId}`, { method: active ? 'PUT' : 'DELETE' });
}