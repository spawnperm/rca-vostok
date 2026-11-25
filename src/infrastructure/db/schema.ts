/**
 * Database schema for the whole platform.
 *
 * The first section is the mvr skeleton's schema (multi-tenant CRM, Mattermost,
 * Office, marketplace). It is primary because the mvr modules are the base of
 * this application and import from this file directly.
 *
 * The second section adds this project's own tables (certification, analytics,
 * identity, social, chat, media, experience, lms) under the same schema object,
 * so one Drizzle instance can serve both halves.
 */

import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  bigint,
  date,
  index,
  numeric,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  subdomain: text('subdomain').notNull().unique(),
  plan: text('plan').notNull().default('growth'),
  status: text('status').notNull().default('active'),
  maxUsers: integer('max_users').notNull().default(50),
  maxDeals: integer('max_deals').notNull().default(10000),
  traefikRule: text('traefik_rule').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const roles = pgTable('roles', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  isSystem: boolean('is_system').notNull().default(false),
  dataScope: text('data_scope').notNull().default('all'),
  hiddenFields: jsonb('hidden_fields').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rolePermissions = pgTable('role_permissions', {
  id: text('id').primaryKey(),
  roleId: text('role_id').notNull(),
  permission: text('permission').notNull(),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  roleId: text('role_id').notNull(),
  avatarUrl: text('avatar_url').notNull(),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const pipelines = pgTable('pipelines', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const pipelineStages = pgTable('pipeline_stages', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  pipelineId: text('pipeline_id').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#3B82F6'),
  sortOrder: integer('sort_order').notNull().default(0),
  isWon: boolean('is_won').notNull().default(false),
  isLost: boolean('is_lost').notNull().default(false),
});

export const companies = pgTable('companies', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  industry: text('industry').notNull().default(''),
  website: text('website').notNull().default(''),
  phone: text('phone').notNull().default(''),
  customFields: jsonb('custom_fields').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contacts = pgTable('contacts', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  position: text('position').notNull().default(''),
  companyId: text('company_id'),
  companyName: text('company_name').notNull().default(''),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  customFields: jsonb('custom_fields').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const deals = pgTable('deals', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  pipelineId: text('pipeline_id').notNull(),
  stageId: text('stage_id').notNull(),
  title: text('title').notNull(),
  budget: integer('budget').notNull().default(0),
  currency: text('currency').notNull().default('RUB'),
  contactId: text('contact_id'),
  companyId: text('company_id'),
  ownerId: text('owner_id').notNull(),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  customFields: jsonb('custom_fields').$type<Record<string, string>>().notNull().default({}),
  lossReason: text('loss_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  dealId: text('deal_id'),
  assigneeId: text('assignee_id').notNull(),
  taskType: text('task_type').notNull().default('followup'),
  title: text('title').notNull(),
  dueAt: timestamp('due_at').notNull(),
  reminderAt: timestamp('reminder_at'),
  reminderNotifiedAt: timestamp('reminder_notified_at'),
  deadlineNotifiedAt: timestamp('deadline_notified_at'),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  completed: boolean('completed').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const timelineEvents = pgTable('timeline_events', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  dealId: text('deal_id').notNull(),
  authorId: text('author_id').notNull(),
  type: text('type').notNull().default('note'),
  body: text('body').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const socialProfiles = pgTable('social_profiles', {
  userId: text('user_id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  handle: text('handle').notNull(),
  headline: text('headline').notNull().default(''),
  department: text('department').notNull().default(''),
  city: text('city').notNull().default('Москва'),
  coverUrl: text('cover_url').notNull(),
  statusText: text('status_text').notNull().default(''),
  bio: text('bio').notNull().default(''),
  skills: jsonb('skills').$type<string[]>().notNull().default([]),
  friendsCount: integer('friends_count').notNull().default(24),
  followersCount: integer('followers_count').notNull().default(118),
});

export const socialGroups = pgTable('social_groups', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  membersCount: integer('members_count').notNull().default(12),
  isJoined: boolean('is_joined').notNull().default(true),
});

export const socialPosts = pgTable('social_posts', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  authorId: text('author_id').notNull(),
  content: text('content').notNull(),
  attachmentType: text('attachment_type').notNull().default('none'),
  attachmentData: jsonb('attachment_data').$type<Record<string, unknown>>().notNull().default({}),
  likesCount: integer('likes_count').notNull().default(0),
  likedByUsers: jsonb('liked_by_users').$type<string[]>().notNull().default([]),
  repostsCount: integer('reposts_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const socialComments = pgTable('social_comments', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  postId: text('post_id').notNull(),
  authorId: text('author_id').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const plugins = pgTable('plugins', {
  id: text('id').primaryKey(),
  npmPackageName: text('npm_package_name').notNull().unique(),
  version: text('version').notNull(),
  verdaccioUrl: text('verdaccio_url').notNull(),
  tarballSha512: text('tarball_sha512').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  author: text('author').notNull(),
  description: text('description').notNull(),
  slot: text('slot').notNull(),
  permissionsRequired: jsonb('permissions_required').$type<string[]>().notNull().default([]),
  defaultConfig: jsonb('default_config').$type<Record<string, unknown>>().notNull().default({}),
  downloads: integer('downloads').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tenantPlugins = pgTable('tenant_plugins', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  pluginId: text('plugin_id').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  installedBy: text('installed_by').notNull(),
  installedAt: timestamp('installed_at').defaultNow().notNull(),
});

export const cmsBlocks = pgTable('cms_blocks', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  sectionType: text('section_type').notNull().default('announcement'),
  body: text('body').notNull(),
  ctaLabel: text('cta_label').notNull().default('Подробнее'),
  published: boolean('published').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const harnessRuns = pgTable('harness_runs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  workflowId: text('workflow_id').notNull(),
  workflowName: text('workflow_name').notNull(),
  actorId: text('actor_id').notNull(),
  inputPayload: jsonb('input_payload').$type<Record<string, unknown>>().notNull().default({}),
  outputPayload: jsonb('output_payload').$type<Record<string, unknown>>().notNull().default({}),
  status: text('status').notNull().default('completed'),
  durationMs: integer('duration_ms').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const natsEvents = pgTable('nats_events', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  subject: text('subject').notNull(),
  actorId: text('actor_id').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const emailTemplates = pgTable('email_templates', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull().default('followup'),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const garageBuckets = pgTable('garage_buckets', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  region: text('region').notNull().default('garage-eu-1'),
  visibility: text('visibility').notNull().default('private'),
  quotaMb: integer('quota_mb').notNull().default(5120),
  endpoint: text('endpoint').notNull().default('http://s3.platform.local:3900'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const garageObjects = pgTable('garage_objects', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  bucketId: text('bucket_id').notNull(),
  bucketName: text('bucket_name').notNull(),
  objectKey: text('object_key').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  etag: text('etag').notNull(),
  versionNumber: integer('version_number').notNull().default(1),
  linkedEntityType: text('linked_entity_type').notNull().default('office_document'),
  linkedEntityId: text('linked_entity_id'),
  createdBy: text('created_by').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const forgejoRepos = pgTable('forgejo_repos', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  ownerSlug: text('owner_slug').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  defaultBranch: text('default_branch').notNull().default('main'),
  cloneUrl: text('clone_url').notNull(),
  visibility: text('visibility').notNull().default('private'),
  lfsBucket: text('lfs_bucket').notNull(),
  description: text('description').notNull().default(''),
  starsCount: integer('stars_count').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const forgejoCommits = pgTable('forgejo_commits', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  repoId: text('repo_id').notNull(),
  branch: text('branch').notNull().default('main'),
  commitSha: text('commit_sha').notNull(),
  message: text('message').notNull(),
  authorName: text('author_name').notNull(),
  authorEmail: text('author_email').notNull(),
  filesChanged: integer('files_changed').notNull().default(1),
  s3ObjectKey: text('s3_object_key'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const officeDocuments = pgTable('office_documents', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  title: text('title').notNull(),
  kind: text('kind').notNull().default('xlsx'),
  dealId: text('deal_id'),
  bucketName: text('bucket_name').notNull(),
  objectKey: text('object_key').notNull(),
  forgejoRepoId: text('forgejo_repo_id'),
  latestCommitSha: text('latest_commit_sha'),
  sizeBytes: integer('size_bytes').notNull().default(0),
  content: jsonb('content').$type<Record<string, unknown>>().notNull().default({}),
  updatedBy: text('updated_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const nocobaseCollections = pgTable('nocobase_collections', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  key: text('key').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  defaultView: text('default_view').notNull().default('table'),
  kanbanGroupBy: text('kanban_group_by'),
  calendarDateField: text('calendar_date_field'),
  pinnedToDashboard: boolean('pinned_to_dashboard').notNull().default(false),
  fields: jsonb('fields').$type<Array<Record<string, unknown>>>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const nocobaseRecords = pgTable('nocobase_records', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  collectionKey: text('collection_key').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const nocobaseWorkflows = pgTable('nocobase_workflows', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  triggerType: text('trigger_type').notNull(),
  triggerConfig: jsonb('trigger_config').$type<Record<string, string>>().notNull().default({}),
  condition: jsonb('condition').$type<Record<string, string> | null>().default(null),
  nodes: jsonb('nodes').$type<Array<Record<string, unknown>>>().notNull().default([]),
  n8nDefinition: jsonb('n8n_definition').$type<Record<string, unknown> | null>().default(null),
  enabled: boolean('enabled').notNull().default(true),
  runsCount: integer('runs_count').notNull().default(0),
  lastRunAt: timestamp('last_run_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const nocobaseWorkflowExecutions = pgTable('nocobase_workflow_executions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  workflowId: text('workflow_id').notNull(),
  workflowName: text('workflow_name').notNull(),
  triggerType: text('trigger_type').notNull(),
  status: text('status').notNull().default('completed'),
  contextSummary: text('context_summary').notNull().default(''),
  stepsLog: jsonb('steps_log').$type<Array<Record<string, unknown>>>().notNull().default([]),
  durationMs: integer('duration_ms').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const nocobaseApprovals = pgTable('nocobase_approvals', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  title: text('title').notNull(),
  entityType: text('entity_type').notNull().default('general'),
  entityId: text('entity_id'),
  entityLabel: text('entity_label').notNull().default(''),
  amount: integer('amount').notNull().default(0),
  requesterId: text('requester_id').notNull(),
  approverRoleCode: text('approver_role_code').notNull().default('sales_head'),
  status: text('status').notNull().default('pending'),
  comment: text('comment').notNull().default(''),
  decisionNote: text('decision_note').notNull().default(''),
  decidedBy: text('decided_by'),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const crmTableSchemas = pgTable('crm_table_schemas', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  entityType: text('entity_type').notNull(),
  sections: jsonb('sections').$type<Array<Record<string, unknown>>>().notNull().default([]),
  fields: jsonb('fields').$type<Array<Record<string, unknown>>>().notNull().default([]),
  viewConfig: jsonb('view_config').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Mattermost Core Tables (Chat + Integrated Social News Feed)
export const mmTeams = pgTable('mm_teams', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  description: text('description').notNull().default(''),
  type: text('type').notNull().default('O'),
  createAt: text('create_at').notNull(),
  updateAt: text('update_at').notNull(),
  deleteAt: text('delete_at').notNull().default('0'),
});

export const mmChannels = pgTable('mm_channels', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  teamId: text('team_id').notNull(),
  type: text('type').notNull().default('O'),
  name: text('name').notNull(),
  displayName: text('display_name').notNull(),
  header: text('header').notNull().default(''),
  purpose: text('purpose').notNull().default(''),
  creatorId: text('creator_id').notNull(),
  totalMsgCount: integer('total_msg_count').notNull().default(0),
  totalMsgCountRoot: integer('total_msg_count_root').notNull().default(0),
  lastPostAt: text('last_post_at').notNull().default('0'),
  props: jsonb('props').$type<Record<string, unknown>>().notNull().default({}),
  createAt: text('create_at').notNull(),
  updateAt: text('update_at').notNull(),
  deleteAt: text('delete_at').notNull().default('0'),
});

export const mmChannelMembers = pgTable('mm_channel_members', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  channelId: text('channel_id').notNull(),
  userId: text('user_id').notNull(),
  roles: text('roles').notNull().default('channel_user'),
  lastViewedAt: text('last_viewed_at').notNull().default('0'),
  msgCount: integer('msg_count').notNull().default(0),
  msgCountRoot: integer('msg_count_root').notNull().default(0),
  mentionCount: integer('mention_count').notNull().default(0),
  notifyProps: jsonb('notify_props').$type<Record<string, string>>().notNull().default({}),
  lastUpdateAt: text('last_update_at').notNull().default('0'),
});

export const mmPosts = pgTable('mm_posts', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  channelId: text('channel_id').notNull(),
  userId: text('user_id').notNull(),
  rootId: text('root_id').notNull().default(''),
  originalId: text('original_id').notNull().default(''),
  message: text('message').notNull().default(''),
  type: text('type').notNull().default(''),
  props: jsonb('props').$type<Record<string, unknown>>().notNull().default({}),
  hashtags: text('hashtags').notNull().default(''),
  isPinned: boolean('is_pinned').notNull().default(false),
  replyCount: integer('reply_count').notNull().default(0),
  socialPostId: text('social_post_id'),
  createAt: text('create_at').notNull(),
  updateAt: text('update_at').notNull(),
  editAt: text('edit_at').notNull().default('0'),
  deleteAt: text('delete_at').notNull().default('0'),
});

export const mmReactions = pgTable('mm_reactions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  postId: text('post_id').notNull(),
  emojiName: text('emoji_name').notNull(),
  createAt: text('create_at').notNull(),
});





/**
 * Tables for this platform's eight bounded contexts.
 *
 * Added to the mvr schema above; kept as one module so both halves share a
 * single Drizzle instance.
 */

// ── identity ────────────────────────────────────────────────────────────────
export const rcaUsers = pgTable(
  'rca_users',
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
      .references(() => rcaUsers.id, { onDelete: 'cascade' }),
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
    .references(() => rcaUsers.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
});

// ── certification ───────────────────────────────────────────────────────────
export const certificationInquiries = pgTable(
  'certification_inquiries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => rcaUsers.id, { onDelete: 'set null' }),
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

export const rcaSocialProfiles = pgTable('rca_social_profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => rcaUsers.id, { onDelete: 'cascade' }),
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

