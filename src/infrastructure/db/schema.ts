import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Drizzle schema mirroring the DDL in ./client.ts.
 *
 * Adopted from the mvr_ skeleton, which used Drizzle to describe its CRM tables.
 * The declaration style is kept; the tables are this platform's eight bounded
 * contexts. Every table here has a matching CREATE TABLE in client.ts, and the
 * two must be changed together — an integration test asserts that the DDL
 * produces exactly these columns.
 */

// ── identity ────────────────────────────────────────────────────────────────
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    region: text('region'),
    role: text('role').notNull().default('candidate'),
    passwordHash: text('password_hash').notNull(),
    passwordSalt: text('password_salt').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => ({
    emailKey: uniqueIndex('users_email_key').on(t.email),
  })
);

export const userSessions = pgTable(
  'user_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    userIdx: index('user_sessions_user_idx').on(t.userId),
  })
);

export const passwordResetTokens = pgTable('password_reset_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
});

// ── certification ───────────────────────────────────────────────────────────
export const certificationInquiries = pgTable(
  'certification_inquiries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    region: text('region'),
    track: text('track'),
    experience: text('experience'),
    message: text('message'),
    status: text('status').notNull().default('new'),
    consentAccepted: boolean('consent_accepted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('inquiries_user_idx').on(t.userId),
  })
);

// ── feedback ────────────────────────────────────────────────────────────────
export const platformFeedback = pgTable('platform_feedback', {
  id: text('id').primaryKey(),
  senderName: text('sender_name').notNull(),
  email: text('email'),
  feedbackType: text('feedback_type').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  rating: integer('rating'),
  status: text('status').notNull().default('new'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── analytics ───────────────────────────────────────────────────────────────
export const analyticsSessions = pgTable('analytics_sessions', {
  sessionId: text('session_id').primaryKey(),
  visitorId: text('visitor_id').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
});

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull(),
    eventKey: text('event_key').notNull(),
    type: text('type').notNull(),
    tab: text('tab').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  },
  (t) => ({
    naturalKey: uniqueIndex('analytics_events_natural_key').on(t.sessionId, t.eventKey),
  })
);

// ── social ──────────────────────────────────────────────────────────────────
export const posts = pgTable('posts', {
  id: text('id').primaryKey(),
  authorId: text('author_id').notNull(),
  authorName: text('author_name').notNull(),
  kind: text('kind').notNull().default('update'),
  title: text('title'),
  body: text('body').notNull(),
  tags: jsonb('tags').notNull().default([]),
  published: boolean('published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  removedAt: timestamp('removed_at', { withTimezone: true }),
});

export const postComments = pgTable('post_comments', {
  id: text('id').primaryKey(),
  postId: text('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull(),
  authorName: text('author_name').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const socialProfiles = pgTable('social_profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  headline: text('headline'),
  bio: text('bio'),
  region: text('region'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── chat ────────────────────────────────────────────────────────────────────
export const chatChannels = pgTable('chat_channels', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  displayName: text('display_name').notNull(),
  visibility: text('visibility').notNull().default('public'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey(),
  channelId: text('channel_id')
    .notNull()
    .references(() => chatChannels.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull(),
  authorName: text('author_name').notNull(),
  body: text('body').notNull(),
  rootId: text('root_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  removedAt: timestamp('removed_at', { withTimezone: true }),
});

export const chatReactions = pgTable(
  'chat_reactions',
  {
    messageId: text('message_id')
      .notNull()
      .references(() => chatMessages.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.messageId, t.userId, t.emoji] }),
  })
);

// ── media ───────────────────────────────────────────────────────────────────
export const mediaAlbums = pgTable('media_albums', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  ownerName: text('owner_name').notNull(),
  title: text('title').notNull(),
  visibility: text('visibility').notNull().default('public'),
  coverAssetId: text('cover_asset_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mediaAssets = pgTable('media_assets', {
  id: text('id').primaryKey(),
  albumId: text('album_id').references(() => mediaAlbums.id, { onDelete: 'set null' }),
  ownerId: text('owner_id').notNull(),
  ownerName: text('owner_name').notNull(),
  title: text('title').notNull(),
  objectKey: text('object_key').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── experience ──────────────────────────────────────────────────────────────
export const experienceEntries = pgTable('experience_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  region: text('region'),
  routeName: text('route_name'),
  distanceKm: numeric('distance_km'),
  startedOn: date('started_on'),
  journal: text('journal'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── lms ─────────────────────────────────────────────────────────────────────
export const lmsProgress = pgTable('lms_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  courseId: text('course_id').notNull(),
  moduleId: text('module_id'),
  status: text('status').notNull().default('not_started'),
  score: integer('score'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── shared ──────────────────────────────────────────────────────────────────
export const schemaMigrations = pgTable('schema_migrations', {
  version: text('version').primaryKey(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
});
