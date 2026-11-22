import type { Comment, Post } from './Post.ts';
import type { ActivityItemDTO, SocialProfile } from './SocialProfile.ts';

export interface FeedQuery {
  /** When set, only this author's posts are returned (profile view). */
  authorId?: string;
  kind?: 'update' | 'article' | 'news';
  tag?: string;
  limit: number;
  offset: number;
  /** Excludes drafts/removed content for non-authors. */
  includeUnpublished?: boolean;
}

export interface SocialRepository {
  // Profile
  findProfile(userId: string): Promise<SocialProfile | null>;
  saveProfile(profile: SocialProfile): Promise<void>;

  // Posts
  savePost(post: Post): Promise<void>;
  findPost(id: string): Promise<Post | null>;
  listPosts(query: FeedQuery): Promise<{ posts: Post[]; total: number }>;
  deletePost(id: string): Promise<void>;
  countPostsByAuthor(authorId: string): Promise<number>;

  // Comments
  saveComment(comment: Comment): Promise<void>;
  listComments(postId: string): Promise<Comment[]>;
  countComments(postId: string): Promise<number>;

  // Reactions
  toggleLike(postId: string, userId: string): Promise<{ liked: boolean; count: number }>;
  hasLiked(postId: string, userId: string): Promise<boolean>;

  // Follow graph
  follow(followerId: string, followeeId: string): Promise<void>;
  unfollow(followerId: string, followeeId: string): Promise<void>;
  isFollowing(followerId: string, followeeId: string): Promise<boolean>;
  countFollowers(userId: string): Promise<number>;
  countFollowing(userId: string): Promise<number>;

  // Activity
  listActivity(userId: string, limit: number): Promise<ActivityItemDTO[]>;
  recordActivity(item: ActivityItemDTO): Promise<void>;
}
