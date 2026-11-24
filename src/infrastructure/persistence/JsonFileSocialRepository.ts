import fs from 'fs';
import { parseRole } from '../../domain/identity/Rbac.ts';
import { Comment, Post, type CommentDTO, type PostDTO } from '../../domain/social/Post.ts';
import {
  SocialProfile,
  type ActivityItemDTO,
} from '../../domain/social/SocialProfile.ts';
import type { FeedQuery, SocialRepository } from '../../domain/social/SocialRepository.ts';
import { atomicWriteJson, ensureDirectory, resolveConfinedPath } from './PathConfinement.ts';

interface StoredSocialProfile {
  userId: string;
  displayName: string;
  headline: string;
  bio: string;
  region: string;
  organisation: string;
  role: string;
  websiteUrl: string;
  coverAssetId: string | null;
  avatarAssetId: string | null;
  skills: string[];
  createdAt: string;
  updatedAt: string;
}

interface StoredFollow {
  followerId: string;
  followeeId: string;
  createdAt: string;
}

interface SocialStore {
  profiles: Record<string, StoredSocialProfile>;
  posts: Record<string, PostDTO>;
  comments: Record<string, CommentDTO[]>;
  likes: Record<string, string[]>;
  follows: StoredFollow[];
  activity: ActivityItemDTO[];
}

function emptyStore(): SocialStore {
  return {
    profiles: {},
    posts: {},
    comments: {},
    likes: {},
    follows: [],
    activity: [],
  };
}

function toProfile(row: StoredSocialProfile): SocialProfile {
  return SocialProfile.rehydrate({
    userId: row.userId,
    displayName: row.displayName,
    headline: row.headline,
    bio: row.bio,
    region: row.region,
    organisation: row.organisation,
    role: parseRole(row.role),
    websiteUrl: row.websiteUrl,
    coverAssetId: row.coverAssetId,
    avatarAssetId: row.avatarAssetId,
    skills: Array.isArray(row.skills) ? row.skills : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toPost(row: PostDTO): Post {
  return Post.rehydrate({
    id: row.id,
    authorId: row.authorId,
    authorName: row.authorName,
    kind: row.kind,
    title: row.title,
    body: row.body,
    excerpt: row.excerpt,
    coverAssetId: row.coverAssetId,
    tags: Array.isArray(row.tags) ? row.tags : [],
    visibility: row.visibility,
    status: row.status,
    likeCount: Number(row.likeCount ?? 0),
    commentCount: Number(row.commentCount ?? 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt ?? null,
  });
}

function toComment(row: CommentDTO): Comment {
  return Comment.rehydrate({
    id: row.id,
    postId: row.postId,
    authorId: row.authorId,
    authorName: row.authorName,
    body: row.body,
    createdAt: row.createdAt,
  });
}

/**
 * JSON-file adapter for the community feed, blog, social profiles and follow graph.
 * Used automatically when PostgreSQL is not configured.
 */
export class JsonFileSocialRepository implements SocialRepository {
  private readonly dataDir: string;
  private readonly fileName: string;
  private readonly tempFileName: string;

  constructor(dataDir: string, fileName = 'social.json') {
    this.dataDir = dataDir;
    this.fileName = fileName;
    this.tempFileName = `${fileName}.tmp`;
  }

  private readStore(): SocialStore {
    ensureDirectory(this.dataDir);
    const targetPath = resolveConfinedPath(this.dataDir, this.fileName);
    if (!fs.existsSync(targetPath)) {
      return emptyStore();
    }
    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<SocialStore> | null;
      if (!parsed || typeof parsed !== 'object') {
        return emptyStore();
      }
      return {
        profiles: parsed.profiles && typeof parsed.profiles === 'object' ? parsed.profiles : {},
        posts: parsed.posts && typeof parsed.posts === 'object' ? parsed.posts : {},
        comments: parsed.comments && typeof parsed.comments === 'object' ? parsed.comments : {},
        likes: parsed.likes && typeof parsed.likes === 'object' ? parsed.likes : {},
        follows: Array.isArray(parsed.follows) ? parsed.follows : [],
        activity: Array.isArray(parsed.activity) ? parsed.activity : [],
      };
    } catch {
      return emptyStore();
    }
  }

  private writeStore(store: SocialStore): void {
    atomicWriteJson(this.dataDir, this.fileName, this.tempFileName, store);
  }

  async findProfile(userId: string): Promise<SocialProfile | null> {
    const store = this.readStore();
    const row = store.profiles[userId];
    return row ? toProfile(row) : null;
  }

  async saveProfile(profile: SocialProfile): Promise<void> {
    const store = this.readStore();
    store.profiles[profile.userId] = {
      userId: profile.userId,
      displayName: profile.displayName,
      headline: profile.headline,
      bio: profile.bio,
      region: profile.region,
      organisation: profile.organisation,
      role: profile.role,
      websiteUrl: profile.websiteUrl,
      coverAssetId: profile.coverAssetId,
      avatarAssetId: profile.avatarAssetId,
      skills: [...profile.skills],
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
    this.writeStore(store);
  }

  async savePost(post: Post): Promise<void> {
    const store = this.readStore();
    store.posts[post.id] = post.toDTO();
    this.writeStore(store);
  }

  async findPost(id: string): Promise<Post | null> {
    const store = this.readStore();
    const row = store.posts[id];
    return row ? toPost(row) : null;
  }

  async listPosts(query: FeedQuery): Promise<{ posts: Post[]; total: number }> {
    const store = this.readStore();
    const tagNeedle = query.tag?.trim().toLowerCase();

    const filtered = Object.values(store.posts)
      .filter((p) => {
        if (query.includeUnpublished) {
          if (p.status === 'removed') return false;
        } else if (p.status !== 'published') {
          return false;
        }
        if (query.authorId && p.authorId !== query.authorId) return false;
        if (query.kind && p.kind !== query.kind) return false;
        if (tagNeedle && !(Array.isArray(p.tags) && p.tags.includes(tagNeedle))) return false;
        return true;
      })
      .sort((a, b) =>
        (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt)
      );

    const sliced = filtered.slice(query.offset, query.offset + query.limit);
    return {
      posts: sliced.map(toPost),
      total: filtered.length,
    };
  }

  async deletePost(id: string): Promise<void> {
    const store = this.readStore();
    const existing = store.posts[id];
    if (!existing) return;
    store.posts[id] = {
      ...existing,
      status: 'removed',
      updatedAt: new Date().toISOString(),
    };
    this.writeStore(store);
  }

  async countPostsByAuthor(authorId: string): Promise<number> {
    const store = this.readStore();
    return Object.values(store.posts).filter(
      (p) => p.authorId === authorId && p.status === 'published'
    ).length;
  }

  async saveComment(comment: Comment): Promise<void> {
    const store = this.readStore();
    const list = store.comments[comment.postId] ?? [];
    if (!list.some((c) => c.id === comment.id)) {
      list.push(comment.toDTO());
      store.comments[comment.postId] = list;
    }
    const post = store.posts[comment.postId];
    if (post) {
      store.posts[comment.postId] = {
        ...post,
        commentCount: store.comments[comment.postId].length,
      };
    }
    this.writeStore(store);
  }

  async listComments(postId: string): Promise<Comment[]> {
    const store = this.readStore();
    const list = store.comments[postId] ?? [];
    return [...list]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, 500)
      .map(toComment);
  }

  async countComments(postId: string): Promise<number> {
    const store = this.readStore();
    return (store.comments[postId] ?? []).length;
  }

  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; count: number }> {
    const store = this.readStore();
    const current = new Set(store.likes[postId] ?? []);
    let liked = false;
    if (current.has(userId)) {
      current.delete(userId);
    } else {
      current.add(userId);
      liked = true;
    }
    store.likes[postId] = [...current];
    const count = current.size;

    const post = store.posts[postId];
    if (post) {
      store.posts[postId] = { ...post, likeCount: count };
    }
    this.writeStore(store);
    return { liked, count };
  }

  async hasLiked(postId: string, userId: string): Promise<boolean> {
    const store = this.readStore();
    return (store.likes[postId] ?? []).includes(userId);
  }

  async follow(followerId: string, followeeId: string): Promise<void> {
    if (followerId === followeeId) return;
    const store = this.readStore();
    const exists = store.follows.some(
      (f) => f.followerId === followerId && f.followeeId === followeeId
    );
    if (!exists) {
      store.follows.push({
        followerId,
        followeeId,
        createdAt: new Date().toISOString(),
      });
      this.writeStore(store);
    }
  }

  async unfollow(followerId: string, followeeId: string): Promise<void> {
    const store = this.readStore();
    const next = store.follows.filter(
      (f) => !(f.followerId === followerId && f.followeeId === followeeId)
    );
    if (next.length !== store.follows.length) {
      store.follows = next;
      this.writeStore(store);
    }
  }

  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    const store = this.readStore();
    return store.follows.some(
      (f) => f.followerId === followerId && f.followeeId === followeeId
    );
  }

  async countFollowers(userId: string): Promise<number> {
    const store = this.readStore();
    return store.follows.filter((f) => f.followeeId === userId).length;
  }

  async countFollowing(userId: string): Promise<number> {
    const store = this.readStore();
    return store.follows.filter((f) => f.followerId === userId).length;
  }

  async listActivity(userId: string, limit: number): Promise<ActivityItemDTO[]> {
    const store = this.readStore();
    return store.activity
      .filter((item) => item.actorId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async recordActivity(item: ActivityItemDTO): Promise<void> {
    const store = this.readStore();
    if (!store.activity.some((a) => a.id === item.id)) {
      store.activity.unshift(item);
      if (store.activity.length > 2000) {
        store.activity = store.activity.slice(0, 2000);
      }
      this.writeStore(store);
    }
  }
}
