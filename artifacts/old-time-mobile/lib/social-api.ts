import { apiBaseUrl } from '@/lib/api-base-url';
import { mobileApiRequest } from '@/lib/mobile-api';

export type SocialUser = {
  id: number;
  name: string;
  username: string;
  bio?: string;
  avatarObjectPath?: string | null;
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
  hubs: Array<{ id: number; name: string; slug: string }>;
  viewer: {
    liked: boolean;
    reposted: boolean;
    saved: boolean;
    viewed: boolean;
    viewExpiresAt: number | null;
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
  likeCount: number;
};

export type UserCard = SocialUser & {
  followerCount: number;
  followingCount: number;
  following: boolean;
  muted: boolean;
  canMessage: boolean;
};
export type SocialConnection = SocialUser & {
  following: boolean;
};

export type ContactPermission = 'everyone' | 'followers' | 'nobody';
export type ChatPresence = 'available' | 'busy' | 'dnd';
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
  mode: 'for-you' | 'following' | 'community';
  items: SocialPost[];
  nextCursor: number | null;
};
export type CommunityFilter = 'friends' | 'following' | 'interests';

export type SearchResults = {
  users: SocialUser[];
  posts: SocialPost[];
};
export type SocialHub = {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string | null;
  coverImage: string | null;
  category: string | null;
  status: 'active' | 'pending' | 'suspended' | 'archived';
  privacy: 'public' | 'private';
  memberCount: number;
  postCount: number;
  createdBy: number;
  joined: boolean;
  role: 'member' | 'moderator' | 'owner' | null;
  parent: { id: number; name: string; slug: string } | null;
  createdAt: number;
  updatedAt: number;
};
export type Story = {
  id: number; kind: 'text' | 'image' | 'video'; content: string;
  textPosition: { x: number; y: number } | null;
  visibility: 'public' | 'friends' | 'followers' | 'close_friends' | 'private';
  media: { type: 'image' | 'video'; objectPath: string; mimeType: string; width?: number; height?: number; duration?: number; fit?: 'contain' | 'cover' } | null;
  createdAt: number; expiresAt: number; location: { latitude: number; longitude: number } | null; author: SocialUser;
  taggedUsers: SocialUser[];
  viewer: { viewed: boolean; isOwner: boolean; reacted: boolean }; counts: { views: number; reactions: number };
};
export type StoryReply = { id: number; storyId: number; authorId: number; content: string; createdAt: number; author: SocialUser };
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

export type Note = {
  id: number;
  content: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  owner: SocialUser;
  viewer: { isOwner: boolean };
};

function baseUrl(): string {
  return apiBaseUrl();
}

const request = mobileApiRequest;

export function socialMediaUrl(objectPath: string): string {
  return `${baseUrl()}/api/storage${objectPath}`;
}

export function socialAvatarUrl(objectPath: string | null | undefined): string | undefined {
  return objectPath ? `${baseUrl()}/api/storage/profile-images${objectPath.replace(/^\/objects/, '')}` : undefined;
}

export function getSocialFeed(
  token: string,
  mode: 'for-you' | 'following' | 'community',
  cursor?: number | null,
  communityFilter?: CommunityFilter,
  interests?: string[],
  mediaOnly = false,
) {
  const query = new URLSearchParams({ mode, limit: '20' });
  if (cursor) query.set('cursor', String(cursor));
  if (communityFilter) query.set('filter', communityFilter);
  if (interests?.length) query.set('interests', interests.join(','));
  if (mediaOnly) query.set('mediaOnly', 'true');
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
    hubIds?: number[];
  },
) {
  return request<SocialPost>(token, '/api/social/posts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getHubDiscovery(token: string, query?: string) {
  const params = new URLSearchParams();
  if (query?.trim()) params.set('q', query.trim());
  return request<{
    myHubs: SocialHub[];
    suggestedHubs: SocialHub[];
    trendingHubs: SocialHub[];
    recentlyActiveHubs: SocialHub[];
    categories: string[];
    searchResults: SocialHub[];
  }>(token, `/api/social/hubs/discover${params.toString() ? `?${params.toString()}` : ''}`);
}

export function searchHubs(token: string, query: string) {
  const params = new URLSearchParams({ q: query, limit: '20' });
  return request<{ items: SocialHub[] }>(token, `/api/social/hubs/search?${params.toString()}`);
}

export function createHub(token: string, input: {
  name: string;
  description?: string;
  category?: string | null;
  parentHubId?: number | null;
  icon?: string | null;
  coverImage?: string | null;
  privacy?: 'public' | 'private';
}) {
  return request<SocialHub>(token, '/api/social/hubs', { method: 'POST', body: JSON.stringify(input) });
}

export function getHub(token: string, hubId: number) {
  return request<{ hub: SocialHub; children: SocialHub[] }>(token, `/api/social/hubs/${hubId}`);
}

export function getMyHubs(token: string) {
  return request<{ items: SocialHub[] }>(token, '/api/social/hubs/my');
}

export function joinHub(token: string, hubId: number) {
  return request<{ success: boolean; joined: boolean }>(token, `/api/social/hubs/${hubId}/join`, { method: 'POST' });
}

export function leaveHub(token: string, hubId: number) {
  return request<{ success: boolean; joined: boolean }>(token, `/api/social/hubs/${hubId}/join`, { method: 'DELETE' });
}

export function getHubFeed(token: string, hubId: number, tab: 'for-you' | 'trending' | 'latest', cursor?: number | null) {
  const params = new URLSearchParams({ tab, limit: '20' });
  if (cursor) params.set('cursor', String(cursor));
  return request<{ items: SocialPost[]; nextCursor: number | null }>(token, `/api/social/hubs/${hubId}/feed?${params.toString()}`);
}

export function setPostHubs(token: string, postId: number, hubIds: number[]) {
  return request<{ post: SocialPost | null }>(token, `/api/social/posts/${postId}/hubs`, {
    method: 'PUT',
    body: JSON.stringify({ hubIds }),
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

export function viewSocialPost(token: string, postId: number) {
  return request<{ success: boolean; expiresAt: number | null }>(token, `/api/social/posts/${postId}/view`, {
    method: 'PUT',
  });
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

export function getUserConnections(
  token: string,
  userId: number,
  type: 'followers' | 'following',
  query?: string,
) {
  const params = new URLSearchParams({ type, limit: '50' });
  if (query?.trim()) params.set('q', query.trim());
  return request<{ items: SocialConnection[] }>(
    token,
    `/api/social/users/${userId}/connections?${params.toString()}`,
  );
}

export function getUserPosts(token: string, userId: number) {
  return request<{ items: SocialPost[] }>(token, `/api/social/users/${userId}/posts?limit=30`);
}

export function updateUserProfile(
  token: string,
  userId: number,
  input: { name?: string; username?: string; bio?: string; avatarObjectPath?: string; birthday?: string; contactPermission?: ContactPermission; phoneNumber?: string | null; phoneDiscoveryPermission?: 'contacts' | 'everyone' | 'nobody'; chatPresence?: ChatPresence },
) {
  return request<{
    id: number;
    phone: string;
    name: string;
    username: string;
    bio: string;
    avatarObjectPath: string | null;
    birthday: string | null;
    contactPermission: ContactPermission;
    online: boolean;
    lastSeen: number;
    lastSeenVisible: boolean;
    chatPresence: ChatPresence;
    hasRegisteredPhone: boolean;
    phoneVerified: boolean;
    phoneDiscoveryPermission: 'contacts' | 'everyone' | 'nobody';
  }>(token, `/api/users/${userId}/profile`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export type DiscoveredContact = {
  phoneHash: string;
  user: {
    id: number; phone: string; name: string; username: string; bio: string;
    birthday: string | null; contactPermission: ContactPermission; online: boolean;
    lastSeen: number; lastSeenVisible: boolean; hasRegisteredPhone: boolean;
    phoneVerified: boolean; phoneDiscoveryPermission: 'contacts' | 'everyone' | 'nobody';
  };
};

export function discoverContacts(token: string, phoneHashes: string[]) {
  return request<{ matches: DiscoveredContact[] }>(token, '/api/users/contact-discovery', {
    method: 'POST',
    body: JSON.stringify({ phoneHashes }),
  });
}

export function completeBirthday(challengeId: string, birthday: string) {
  return request<{
    id: number;
    phone: string;
    name: string;
    username: string;
    bio: string;
    avatarObjectPath: string | null;
    birthday: string | null;
    contactPermission: ContactPermission;
    online: boolean;
    lastSeen: number;
    lastSeenVisible: boolean;
    hasRegisteredPhone: boolean;
    phoneVerified: boolean;
    phoneDiscoveryPermission: 'contacts' | 'everyone' | 'nobody';
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
export function getStory(token: string, storyId: number) { return request<Story>(token, `/api/social/stories/${storyId}`); }
export function getNotes(token: string, surface: 'messages' | 'chat' = 'messages') {
  return request<{ items: Note[] }>(token, `/api/social/notes?surface=${surface}`);
}
export function createNote(token: string, content: string) {
  return request<Note>(token, '/api/social/notes', {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}
export function updateNote(token: string, noteId: number, content: string) {
  return request<Note>(token, `/api/social/notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}
export function deleteNote(token: string, noteId: number) {
  return request<{ success: boolean }>(token, `/api/social/notes/${noteId}`, { method: 'DELETE' });
}
export function getNearbyStories(token: string, latitude: number, longitude: number, radiusKm = 5, limit = 60) {
  return request<{ items: Story[] }>(token, `/api/social/stories/nearby?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&radiusKm=${encodeURIComponent(radiusKm)}&limit=${encodeURIComponent(limit)}`);
}
export function createStory(token: string, input: { content: string; textPosition?: Story['textPosition']; visibility: Story['visibility']; media?: Story['media']; location?: { latitude: number; longitude: number } | null; taggedUserIds?: number[] }) {
  return request<Story>(token, '/api/social/stories', { method: 'POST', body: JSON.stringify(input) });
}
export function viewStory(token: string, storyId: number) { return request<{ success: boolean }>(token, `/api/social/stories/${storyId}/view`, { method: 'PUT' }); }
export function reactToStory(token: string, storyId: number, reaction: string) { return request<{ success: boolean }>(token, `/api/social/stories/${storyId}/reaction`, { method: 'PUT', body: JSON.stringify({ reaction }) }); }
export function removeStoryReaction(token: string, storyId: number) { return request<{ success: boolean }>(token, `/api/social/stories/${storyId}/reaction`, { method: 'DELETE' }); }
export function replyToStory(token: string, storyId: number, content: string) { return request<StoryReply>(token, `/api/social/stories/${storyId}/replies`, { method: 'POST', body: JSON.stringify({ content }) }); }
export function getStoryReplies(token: string, storyId: number) { return request<{ items: StoryReply[] }>(token, `/api/social/stories/${storyId}/replies`); }
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
