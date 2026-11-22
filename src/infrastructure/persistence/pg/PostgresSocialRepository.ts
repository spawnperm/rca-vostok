import type pg from 'pg';
import { Comment, Post } from '../../../domain/social/Post.ts';
import { SocialProfile } from '../../../domain/social/SocialProfile.ts';
import type { ActivityItemDTO } from '../../../domain/social/SocialProfile.ts';
import type {
  SocialRepository,
  FeedQuery,
} from '../../../domain/social/SocialRepository.ts';
import { parseRole } from '../../../domain/identity/Rbac.ts';

interface ProfileRow {
  user_id: string;
  display_name: string;
  headline: string;
  bio: string;
  region: string;
  organisation: string;
  role: string;
  website_url: string;
  cover_asset_id: string | null;
  avatar_asset_id: string | null;
  skills: string[];
  created_at: Date;
  updated_at: Date;
}

interface PostRow {
  id: string;
  author_id: string;
  author_name: string;
  kind: string;
  title: string;
  body: string;
  excerpt: string;
  cover_asset_id: string | null;
  tags: string[];
  visibility: string;
  status: string;
  like_count: number;
  comment_count: number;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
}

interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: Date;
}

function toProfile(row: ProfileRow): SocialProfile {
  return SocialProfile.rehydrate({
    userId: row.user_id,
    displayName: row.display_name,
    headline: row.headline,
    bio: row.bio,
    region: row.region,
    organisation: row.organisation,
    role: parseRole(row.role),
    websiteUrl: row.website_url,
    coverAssetId: row.cover_asset_id,
    avatarAssetId: row.avatar_asset_id,
    skills: row.skills ?? [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });
}

function toPost(row: PostRow): Post {
  return Post.rehydrate({
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    kind: row.kind,
    title: row.title,
    body: row.body,
    excerpt: row.excerpt,
    coverAssetId: row.cover_asset_id,
    tags: row.tags ?? [],
    visibility: row.visibility,
    status: row.status,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
  });
}

function toComment(row: CommentRow): Comment {
  return Comment.rehydrate({
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at.toISOString(),
  });
}

/** PostgreSQL adapter for the community feed, blog and social graph. */
export class PostgresSocialRepository implements SocialRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async findProfile(userId: string): Promise<SocialProfile | null> {
    const res = await this.pool.query<ProfileRow>(
      'SELECT * FROM social_profiles WHERE user_id = $1',
      [userId]
    );
    return res.rows.length > 0 ? toProfile(res.rows[0]) : null;
  }

  async saveProfile(profile: SocialProfile): Promise<void> {
    await this.pool.query(
      `INSERT INTO social_profiles (
         user_id, display_name, headline, bio, region, organisation, role,
         website_url, cover_asset_id, avatar_asset_id, skills, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (user_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         headline = EXCLUDED.headline,
         bio = EXCLUDED.bio,
         region = EXCLUDED.region,
         organisation = EXCLUDED.organisation,
         role = EXCLUDED.role,
         website_url = EXCLUDED.website_url,
         cover_asset_id = EXCLUDED.cover_asset_id,
         avatar_asset_id = EXCLUDED.avatar_asset_id,
         skills = EXCLUDED.skills,
         updated_at = EXCLUDED.updated_at`,
      [
        profile.userId,
        profile.displayName,
        profile.headline,
        profile.bio,
        profile.region,
        profile.organisation,
        profile.role,
        profile.websiteUrl,
        profile.coverAssetId,
        profile.avatarAssetId,
        profile.skills,
        profile.createdAt,
        profile.updatedAt,
      ]
    );
  }

  async savePost(post: Post): Promise<void> {
    await this.pool.query(
      `INSERT INTO posts (
         id, author_id, author_name, kind, title, body, excerpt,
         cover_asset_id, tags, visibility, status, like_count, comment_count,
         created_at, updated_at, published_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         body = EXCLUDED.body,
         excerpt = EXCLUDED.excerpt,
         cover_asset_id = EXCLUDED.cover_asset_id,
         tags = EXCLUDED.tags,
         visibility = EXCLUDED.visibility,
         status = EXCLUDED.status,
         like_count = EXCLUDED.like_count,
         comment_count = EXCLUDED.comment_count,
         updated_at = EXCLUDED.updated_at,
         published_at = EXCLUDED.published_at`,
      [
        post.id,
        post.authorId,
        post.authorName,
        post.kind,
        post.title,
        post.body,
        post.excerpt,
        post.coverAssetId,
        post.tags,
        post.visibility,
        post.status,
        post.likeCount,
        post.commentCount,
        post.createdAt,
        post.updatedAt,
        post.publishedAt,
      ]
    );
  }

  async findPost(id: string): Promise<Post | null> {
    const res = await this.pool.query<PostRow>('SELECT * FROM posts WHERE id = $1', [id]);
    return res.rows.length > 0 ? toPost(res.rows[0]) : null;
  }

  async listPosts(query: FeedQuery): Promise<{ posts: Post[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];

    // Non-authors never see drafts or removed content.
    if (query.includeUnpublished) {
      where.push(`status <> 'removed'`);
    } else {
      where.push(`status = 'published'`);
    }

    if (query.authorId) {
      params.push(query.authorId);
      where.push(`author_id = $${params.length}`);
    }
    if (query.kind) {
      params.push(query.kind);
      where.push(`kind = $${params.length}`);
    }
    if (query.tag) {
      params.push(query.tag.toLowerCase());
      where.push(`$${params.length} = ANY(tags)`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM posts ${whereSql}`,
      params
    );

    params.push(query.limit, query.offset);
    const rows = await this.pool.query<PostRow>(
      `SELECT * FROM posts ${whereSql}
        ORDER BY COALESCE(published_at, created_at) DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return { posts: rows.rows.map(toPost), total: Number(countRes.rows[0]?.count ?? 0) };
  }

  async deletePost(id: string): Promise<void> {
    // Soft delete keeps comment/thread references intact.
    await this.pool.query(`UPDATE posts SET status = 'removed' WHERE id = $1`, [id]);
  }

  async countPostsByAuthor(authorId: string): Promise<number> {
    const res = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM posts WHERE author_id = $1 AND status = 'published'`,
      [authorId]
    );
    return Number(res.rows[0]?.count ?? 0);
  }

  async saveComment(comment: Comment): Promise<void> {
    await this.pool.query(
      `INSERT INTO post_comments (id, post_id, author_id, author_name, body, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO NOTHING`,
      [
        comment.id,
        comment.postId,
        comment.authorId,
        comment.authorName,
        comment.body,
        comment.createdAt,
      ]
    );
    // Denormalised counter keeps the feed cheap to render.
    await this.pool.query(
      `UPDATE posts SET comment_count = (SELECT COUNT(*) FROM post_comments WHERE post_id = $1)
        WHERE id = $1`,
      [comment.postId]
    );
  }

  async listComments(postId: string): Promise<Comment[]> {
    const res = await this.pool.query<CommentRow>(
      `SELECT * FROM post_comments WHERE post_id = $1 ORDER BY created_at ASC LIMIT 500`,
      [postId]
    );
    return res.rows.map(toComment);
  }

  async countComments(postId: string): Promise<number> {
    const res = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM post_comments WHERE post_id = $1',
      [postId]
    );
    return Number(res.rows[0]?.count ?? 0);
  }

  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; count: number }> {
    const del = await this.pool.query(
      'DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    let liked = false;
    if ((del.rowCount ?? 0) === 0) {
      await this.pool.query(
        `INSERT INTO post_likes (post_id, user_id, created_at)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [postId, userId, new Date().toISOString()]
      );
      liked = true;
    }

    const countRes = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM post_likes WHERE post_id = $1',
      [postId]
    );
    const count = Number(countRes.rows[0]?.count ?? 0);

    await this.pool.query(`UPDATE posts SET like_count = $2 WHERE id = $1`, [postId, count]);
    return { liked, count };
  }

  async hasLiked(postId: string, userId: string): Promise<boolean> {
    const res = await this.pool.query(
      'SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );
    return res.rows.length > 0;
  }

  async follow(followerId: string, followeeId: string): Promise<void> {
    if (followerId === followeeId) return;
    await this.pool.query(
      `INSERT INTO social_follows (follower_id, followee_id, created_at)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [followerId, followeeId, new Date().toISOString()]
    );
  }

  async unfollow(followerId: string, followeeId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM social_follows WHERE follower_id = $1 AND followee_id = $2',
      [followerId, followeeId]
    );
  }

  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    const res = await this.pool.query(
      'SELECT 1 FROM social_follows WHERE follower_id = $1 AND followee_id = $2',
      [followerId, followeeId]
    );
    return res.rows.length > 0;
  }

  async countFollowers(userId: string): Promise<number> {
    const res = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM social_follows WHERE followee_id = $1',
      [userId]
    );
    return Number(res.rows[0]?.count ?? 0);
  }

  async countFollowing(userId: string): Promise<number> {
    const res = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM social_follows WHERE follower_id = $1',
      [userId]
    );
    return Number(res.rows[0]?.count ?? 0);
  }

  async listActivity(userId: string, limit: number): Promise<ActivityItemDTO[]> {
    const res = await this.pool.query<{
      id: string;
      type: string;
      actor_id: string;
      actor_name: string;
      summary: string;
      target_id: string | null;
      created_at: Date;
    }>(
      `SELECT id, type, actor_id, actor_name, summary, target_id, created_at
         FROM social_activity
        WHERE actor_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [userId, limit]
    );

    return res.rows.map((row) => ({
      id: row.id,
      type: row.type as ActivityItemDTO['type'],
      actorId: row.actor_id,
      actorName: row.actor_name,
      summary: row.summary,
      targetId: row.target_id,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async recordActivity(item: ActivityItemDTO): Promise<void> {
    await this.pool.query(
      `INSERT INTO social_activity (id, type, actor_id, actor_name, summary, target_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [
        item.id,
        item.type,
        item.actorId,
        item.actorName,
        item.summary,
        item.targetId,
        item.createdAt,
      ]
    );
  }
}
