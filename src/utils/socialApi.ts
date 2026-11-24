/**
 * Client for the social, chat and media APIs.
 *
 * Errors carry the server's domain message so components can render domain
 * wording instead of generic failure text.
 */

export type PostKind = 'update' | 'article' | 'news';

export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  kind: PostKind;
  title: string;
  body: string;
  excerpt: string;
  coverAssetId: string | null;
  tags: string[];
  status: 'draft' | 'published' | 'removed';
  likeCount: number;
  commentCount: number;
  createdAt: string;
  publishedAt: string | null;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface SocialProfileData {
  userId: string;
  displayName: string;
  headline: string;
  bio: string;
  region: string;
  organisation: string;
  role: string;
  phone: string;
  telegram: string;
  publicEmail: string;
  vkUrl: string;
  websiteUrl: string;
  coverUrl: string;
  avatarUrl: string;
  coverAssetId: string | null;
  avatarAssetId: string | null;
  skills: string[];
  followerCount: number;
  followingCount: number;
  postCount: number;
  albumCount: number;
  isFollowedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityItem {
  id: string;
  type: 'post' | 'album' | 'comment' | 'follow';
  actorName: string;
  summary: string;
  createdAt: string;
}

export interface ChatChannel {
  id: string;
  slug: string;
  displayName: string;
  purpose: string;
  type: 'public' | 'private';
  memberCount: number;
  unreadCount?: number;
}

export interface ChatReaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface ChatMessageData {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  body: string;
  rootId: string | null;
  replyCount: number;
  reactions: ChatReaction[];
  editedAt: string | null;
  createdAt: string;
}

export interface MediaAlbum {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  description: string;
  visibility: 'public' | 'private';
  coverAssetId: string | null;
  assetCount: number;
  createdAt: string;
}

export interface MediaAssetData {
  id: string;
  albumId: string | null;
  ownerId: string;
  ownerName: string;
  kind: 'image' | 'video' | 'audio';
  title: string;
  description: string;
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  url?: string;
}

export class SocialApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = 'ERROR') {
    super(message);
    this.name = 'SocialApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  });

  const text = await res.text();
  const payload = text ? safeJson(text) : null;

  if (!res.ok) {
    const body = (payload ?? {}) as { error?: string; code?: string };
    throw new SocialApiError(
      body.error || `Запрос завершился с ошибкой (${res.status}).`,
      res.status,
      body.code || 'HTTP_ERROR'
    );
  }
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const socialApi = {
  feed: (params: {
    authorId?: string;
    kind?: PostKind;
    tag?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.authorId) qs.set('authorId', params.authorId);
    if (params.kind) qs.set('kind', params.kind);
    if (params.tag) qs.set('tag', params.tag);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    return request<{ posts: FeedPost[]; total: number }>(`/api/social/feed?${qs}`);
  },

  createPost: (input: {
    kind?: PostKind;
    title?: string;
    body: string;
    tags?: string[];
    publish?: boolean;
  }) =>
    request<FeedPost>('/api/social/posts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updatePost: (
    postId: string,
    input: {
      title?: string;
      body?: string;
      tags?: string[];
      publish?: boolean;
    }
  ) =>
    request<FeedPost>(`/api/social/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  deletePost: (postId: string) =>
    request<{ ok: true }>(`/api/social/posts/${postId}`, {
      method: 'DELETE',
    }),

  getPost: (postId: string) =>
    request<{ post: FeedPost; comments: PostComment[] }>(`/api/social/posts/${postId}`),

  addComment: (postId: string, body: string) =>
    request<PostComment>(`/api/social/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  toggleLike: (postId: string) =>
    request<{ liked: boolean; count: number }>(`/api/social/posts/${postId}/like`, {
      method: 'POST',
    }),

  profile: (userId: string) => request<SocialProfileData>(`/api/social/profiles/${userId}`),

  updateProfile: (input: Record<string, unknown>) =>
    request<SocialProfileData>('/api/social/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  follow: (userId: string, follow: boolean) =>
    request<{ following: boolean; followerCount: number }>(
      `/api/social/profiles/${userId}/follow`,
      { method: 'POST', body: JSON.stringify({ follow }) }
    ),

  activity: (limit = 20) =>
    request<{ activity: ActivityItem[] }>(`/api/social/activity?limit=${limit}`),
};

export const chatApi = {
  channels: () => request<{ channels: ChatChannel[] }>('/api/chat/channels'),

  createChannel: (input: { displayName: string; purpose?: string }) =>
    request<ChatChannel>('/api/chat/channels', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  join: (channelId: string) =>
    request<{ ok: true }>(`/api/chat/channels/${channelId}/join`, { method: 'POST' }),

  messages: (channelId: string, threadRootId?: string) => {
    const qs = new URLSearchParams();
    if (threadRootId) qs.set('threadRootId', threadRootId);
    return request<{ messages: ChatMessageData[]; members: unknown[] }>(
      `/api/chat/channels/${channelId}/messages?${qs}`
    );
  },

  send: (channelId: string, body: string, rootId?: string) =>
    request<ChatMessageData>(`/api/chat/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body, rootId }),
    }),

  edit: (messageId: string, body: string) =>
    request<ChatMessageData>(`/api/chat/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    }),

  remove: (messageId: string) =>
    request<{ ok: true }>(`/api/chat/messages/${messageId}`, {
      method: 'DELETE',
    }),

  react: (messageId: string, emoji: string) =>
    request<{ emoji: string; active: boolean }>(
      `/api/chat/messages/${messageId}/reactions`,
      { method: 'POST', body: JSON.stringify({ emoji }) }
    ),

  reactions: () => request<{ emoji: string[] }>('/api/chat/reactions'),
};

export const mediaApi = {
  albums: (params: { ownerId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.ownerId) qs.set('ownerId', params.ownerId);
    return request<{ albums: MediaAlbum[]; total: number }>(`/api/media/albums?${qs}`);
  },

  createAlbum: (input: { title: string; description?: string; visibility?: 'public' | 'private' }) =>
    request<MediaAlbum>('/api/media/albums', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  assets: (params: { albumId?: string; ownerId?: string; kind?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.albumId) qs.set('albumId', params.albumId);
    if (params.ownerId) qs.set('ownerId', params.ownerId);
    if (params.kind) qs.set('kind', params.kind);
    return request<{ assets: MediaAssetData[]; total: number }>(`/api/media/assets?${qs}`);
  },

  /**
   * Uploads a file as a raw body.
   *
   * Metadata travels in the query string; the server validates type and size
   * against the domain rules before storing anything.
   */
  async upload(file: File, options: { albumId?: string; title?: string } = {}) {
    const mimeType = inferUploadMimeType(file);
    const qs = new URLSearchParams({
      mimeType,
      sizeBytes: String(file.size),
    });
    if (options.albumId) qs.set('albumId', options.albumId);
    if (options.title) qs.set('title', options.title);

    const res = await fetch(`/api/media/assets?${qs}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': mimeType },
      body: file,
    });

    const text = await res.text();
    const payload = text ? safeJson(text) : null;
    if (!res.ok) {
      const body = (payload ?? {}) as { error?: string };
      throw new SocialApiError(body.error || 'Не удалось загрузить файл.', res.status);
    }
    return payload as MediaAssetData;
  },

  deleteAsset: (assetId: string) =>
    request<{ ok: true }>(`/api/media/assets/${assetId}`, { method: 'DELETE' }),

  deleteAlbum: (albumId: string) =>
    request<{ ok: true }>(`/api/media/albums/${albumId}`, { method: 'DELETE' }),
};

function inferUploadMimeType(file: File): string {
  if (file.type && file.type.includes('/')) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    gif: 'image/gif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    ogv: 'video/ogg',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
  };
  return map[ext] ?? 'application/octet-stream';
}
