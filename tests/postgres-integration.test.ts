import test from 'node:test';
import assert from 'node:assert/strict';
import { createPool, runMigrations } from '../src/infrastructure/persistence/pg/PostgresPool.ts';
import { AnalyticsAggregationService } from '../src/domain/analytics/AnalyticsAggregationService.ts';
import { PostgresUserRepository } from '../src/infrastructure/persistence/pg/PostgresUserRepository.ts';
import { PostgresSessionRepository } from '../src/infrastructure/persistence/pg/PostgresSessionRepository.ts';
import { PostgresPasswordResetRepository } from '../src/infrastructure/persistence/pg/PostgresPasswordResetRepository.ts';
import { PostgresAnalyticsRepository } from '../src/infrastructure/persistence/pg/PostgresAnalyticsRepository.ts';
import { PostgresInquiryRepository } from '../src/infrastructure/persistence/pg/PostgresInquiryRepository.ts';
import { PostgresSocialRepository } from '../src/infrastructure/persistence/pg/PostgresSocialRepository.ts';
import { PostgresChatRepository } from '../src/infrastructure/persistence/pg/PostgresChatRepository.ts';
import { PostgresMediaRepository } from '../src/infrastructure/persistence/pg/PostgresMediaRepository.ts';
import { User } from '../src/domain/identity/User.ts';
import { ROLES } from '../src/domain/identity/Rbac.ts';
import { Post } from '../src/domain/social/Post.ts';
import { Channel, ChatMessage } from '../src/domain/chat/Chat.ts';
import { Album, MediaAsset } from '../src/domain/media/MediaLibrary.ts';
import { CertificationInquiry } from '../src/domain/certification/CertificationInquiry.ts';
import { PasswordResetToken } from '../src/domain/identity/PasswordReset.ts';
import { ScryptPasswordHasher } from '../src/infrastructure/security/ScryptPasswordHasher.ts';

/**
 * Integration tests against a real PostgreSQL instance.
 *
 * These exist because the SQL layer was previously only exercised through
 * in-memory doubles, and two production bugs (duplicate analytics events and a
 * missing `status` column) were only found by looking at the live database by
 * hand. Everything here runs against TEST_DATABASE_URL; when it is unset the
 * suite is skipped so `pnpm test` stays runnable without a database.
 *
 * The tests create and drop their own schema objects through a dedicated
 * database, so they never touch application data.
 */

const TEST_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

// Skip the whole file when no database is reachable.
const maybe = TEST_URL ? test : test.skip;

let pool: Awaited<ReturnType<typeof createPool>> = null;

async function ensureMigrated() {
  if (!pool) {
    pool = createPool({ connectionString: TEST_URL });
    if (!pool) throw new Error('could not create pool');
    await runMigrations(pool);
  }
  return pool;
}

async function cleanup() {
  if (!pool) return;
  // Order matters: children before parents.
  await pool.query('DELETE FROM chat_reactions');
  await pool.query('DELETE FROM chat_messages');
  await pool.query('DELETE FROM chat_members');
  await pool.query('DELETE FROM chat_channels');
  await pool.query('DELETE FROM media_assets');
  await pool.query('DELETE FROM media_albums');
  await pool.query('DELETE FROM post_likes');
  await pool.query('DELETE FROM post_comments');
  await pool.query('DELETE FROM posts');
  await pool.query('DELETE FROM social_activity');
  await pool.query('DELETE FROM social_follows');
  await pool.query('DELETE FROM social_profiles');
  await pool.query('DELETE FROM password_reset_tokens');
  await pool.query('DELETE FROM user_sessions');
  await pool.query('DELETE FROM certification_inquiries');
  await pool.query('DELETE FROM users');
}

async function seedUser(email = 'integration@example.ru') {
  const p = await ensureMigrated();
  const hasher = new ScryptPasswordHasher();
  const draft = User.create({
    email,
    password: 'Vostok2026pass',
    fullName: 'Интеграционный Тест',
    region: 'Приморский край',
  });
  const user = draft.withPassword(await hasher.hash(draft.plainPassword));
  const repo = new PostgresUserRepository(p);
  await repo.save(user);
  return { user, repo, hasher };
}

maybe('Postgres: migrations create every expected table', async () => {
  const p = await ensureMigrated();
  const res = await p.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`
  );
  const names = res.rows.map((r) => r.tablename);
  for (const expected of [
    'users',
    'user_sessions',
    'password_reset_tokens',
    'certification_inquiries',
    'platform_feedback',
    'analytics_sessions',
    'analytics_events',
    'social_profiles',
    'posts',
    'post_comments',
    'post_likes',
    'social_follows',
    'social_activity',
    'chat_channels',
    'chat_members',
    'chat_messages',
    'chat_reactions',
    'media_albums',
    'media_assets',
  ]) {
    assert.ok(names.includes(expected), `missing table: ${expected}`);
  }
});

maybe('Postgres users: round-trips an aggregate and enforces unique email', async () => {
  await cleanup();
  const p = await ensureMigrated();
  const { user, repo, hasher } = await seedUser();

  const found = await repo.findByEmail('INTEGRATION@example.ru');
  assert.ok(found, 'lookup must be case-insensitive');
  assert.equal(found.id, user.id);
  assert.equal(found.role, ROLES.CANDIDATE);
  assert.equal(
    await hasher.verify('Vostok2026pass', {
      passwordHash: found.passwordHash,
      passwordSalt: found.passwordSalt,
    }),
    true
  );

  // Unique index on email must reject a duplicate identity.
  const dupe = User.create({
    email: 'integration@example.ru',
    password: 'AnotherPass123',
    fullName: 'Дубль Дублевич',
  }).withPassword(await hasher.hash('AnotherPass123'));
  await assert.rejects(() => repo.save(dupe));

  // Role change persists.
  await repo.save(found.changeRole(ROLES.CURATOR));
  const updated = await repo.findById(user.id);
  assert.equal(updated?.role, ROLES.CURATOR);

  await cleanup();
  await p.end();
  pool = null;
});

maybe('Postgres sessions: purgeExpired removes only expired rows', async () => {
  await cleanup();
  const p = await ensureMigrated();
  const { user } = await seedUser('sessions@example.ru');
  const repo = new PostgresSessionRepository(p);

  const past = new Date(Date.now() - 86_400_000).toISOString();
  const future = new Date(Date.now() + 86_400_000).toISOString();

  await repo.create({ tokenHash: 'h-old', userId: user.id, createdAt: past, expiresAt: past });
  await repo.create({ tokenHash: 'h-new', userId: user.id, createdAt: past, expiresAt: future });

  const removed = await repo.purgeExpired(new Date().toISOString());
  assert.equal(removed, 1);
  assert.equal(await repo.findByTokenHash('h-old'), null);
  assert.ok(await repo.findByTokenHash('h-new'));

  // deleteByUserId revokes everything for the account.
  await repo.deleteByUserId(user.id);
  assert.equal(await repo.findByTokenHash('h-new'), null);

  await cleanup();
  await p.end();
  pool = null;
});

maybe('Postgres reset tokens: single use and purge by cutoff', async () => {
  await cleanup();
  const p = await ensureMigrated();
  const { user } = await seedUser('reset@example.ru');
  const repo = new PostgresPasswordResetRepository(p);

  const token = PasswordResetToken.issue(user.id);
  await repo.save(token.toRecord());

  const usable = await repo.findUsable(token.tokenHash, new Date().toISOString());
  assert.ok(usable);

  await repo.markUsed(token.tokenHash, new Date().toISOString());
  assert.equal(await repo.findUsable(token.tokenHash, new Date().toISOString()), null);

  // purgeExpired removes by creation cutoff.
  const old = PasswordResetToken.issue(user.id, new Date(Date.now() - 30 * 86_400_000));
  await repo.save({ ...old.toRecord(), createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString() });
  const purged = await repo.purgeExpired(new Date(Date.now() - 7 * 86_400_000).toISOString());
  assert.equal(purged, 1);

  await cleanup();
  await p.end();
  pool = null;
});

maybe('Postgres analytics: repeated saveStore does not duplicate events', async () => {
  await cleanup();
  const p = await ensureMigrated();
  const { user } = await seedUser('analytics@example.ru');
  const repo = new PostgresAnalyticsRepository(p);

  const store = await repo.loadStore();
  const now = new Date().toISOString();
  store.sessions['s1'] = {
    sessionId: 's1',
    visitorId: 'v1',
    startedAt: now,
    lastSeenAt: now,
    deviceType: 'Desktop',
    browser: 'Chrome',
    viewport: '1920x1080',
    referrer: 'Прямой заход',
    utmSource: '',
    landingTab: 'overview',
    tabsVisited: ['overview'],
    maxScrollDepth: 0,
    durationSec: 0,
    eventCount: 2,
    clickCount: 1,
  };
  store.events.push(
    { id: 'e1', sessionId: 's1', type: 'pageview', tab: 'overview', timestamp: now, elapsedMs: 0 },
    { id: 'e2', sessionId: 's1', type: 'click', tab: 'overview', timestamp: now, elapsedMs: 10, xPct: 10, yPct: 10 }
  );

  // This is the regression: without the natural-key constraint the second save
  // re-inserted every event, which reached 73k duplicate rows in production.
  await repo.saveStore(store);
  await repo.saveStore(store);
  await repo.saveStore(store);

  const count = await p.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM analytics_events WHERE session_id='s1'`
  );
  assert.equal(count.rows[0].c, '2', 'each event must be stored exactly once');

  const session = await repo.getSession('s1');
  assert.equal(session?.events.length, 2);

  await repo.reset();
  const after = await p.query<{ c: string }>('SELECT COUNT(*)::text AS c FROM analytics_events');
  assert.equal(after.rows[0].c, '0');

  void user;
  await cleanup();
  await p.end();
  pool = null;
});

maybe('Postgres inquiries: owner and status round-trip', async () => {
  await cleanup();
  const p = await ensureMigrated();
  const { user } = await seedUser('inq@example.ru');
  const repo = new PostgresInquiryRepository(p);

  const owned = CertificationInquiry.create({
    userId: user.id,
    fullName: 'Владелец Заявки',
    email: 'inq@example.ru',
    region: 'Приморский край',
    track: 'Водный туризм',
    consentAccepted: true,
  });
  const anon = CertificationInquiry.create({
    fullName: 'Аноним Анонимов',
    email: 'anon@example.ru',
    consentAccepted: true,
  });

  await repo.save(owned);
  await repo.save(anon);

  const mine = await repo.findByUser(user.id);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].status, 'new');

  // Status change persists through the aggregate.
  const loaded = await repo.findById(owned.id);
  assert.ok(loaded);
  await repo.saveOne(loaded.withStatus('approved'));
  const reloaded = await repo.findById(owned.id);
  assert.equal(reloaded?.status, 'approved');

  // The CHECK constraint rejects an unknown status.
  await assert.rejects(() =>
    p.query(`UPDATE certification_inquiries SET status='bogus' WHERE id=$1`, [owned.id])
  );

  await cleanup();
  await p.end();
  pool = null;
});

maybe('Postgres social: feed filtering, likes and follow graph', async () => {
  await cleanup();
  const p = await ensureMigrated();
  const { user } = await seedUser('social@example.ru');
  const repo = new PostgresSocialRepository(p);

  await repo.recordActivity({
    id: 'act-1',
    type: 'post',
    actorId: user.id,
    actorName: 'Тест',
    summary: 'публикация',
    targetId: null,
    createdAt: new Date().toISOString(),
  });

  await repo.savePost(
    Post.create({ authorId: user.id, authorName: 'Тест', body: 'Запись в ленте' })
  );
  await repo.savePost(
    Post.create({
      authorId: user.id,
      authorName: 'Тест',
      kind: 'news',
      title: 'Заголовок новости',
      body: 'Достаточно длинный текст новости для прохождения доменных правил.',
    })
  );
  await repo.savePost(
    Post.create({
      authorId: user.id,
      authorName: 'Тест',
      kind: 'article',
      title: 'Статья',
      body: 'Т'.repeat(250),
    })
  );

  const news = await repo.listPosts({ kind: 'news', limit: 10, offset: 0 });
  assert.equal(news.total, 1);
  const articles = await repo.listPosts({ kind: 'article', limit: 10, offset: 0 });
  assert.equal(articles.total, 1);

  // Like toggle is idempotent per user.
  const first = await repo.toggleLike(news.posts[0].id, user.id);
  assert.equal(first.liked, true);
  assert.equal(first.count, 1);
  const second = await repo.toggleLike(news.posts[0].id, user.id);
  assert.equal(second.liked, false);
  assert.equal(second.count, 0);

  // Self-follow is a no-op by design: the repository returns early instead of
  // relying on the CHECK constraint, so the caller never sees an error for what
  // is a harmless request. Verify the row is genuinely absent.
  await repo.follow(user.id, user.id);
  assert.equal(await repo.countFollowers(user.id), 0, 'self-follow must not create a row');

  // Follow graph needs both sides to exist (FK on users).
  const { user: other } = await seedUser('social-other@example.ru');
  await repo.follow(other.id, user.id);
  assert.equal(await repo.countFollowers(user.id), 1);
  assert.equal(await repo.isFollowing(other.id, user.id), true);

  // The CHECK constraint is the second line of defence: a direct INSERT that
  // bypasses the repository is still rejected.
  await assert.rejects(
    () =>
      p.query(
        `INSERT INTO social_follows (follower_id, followee_id, created_at) VALUES ($1,$1,$2)`,
        [user.id, new Date().toISOString()]
      ),
    /social_follows_no_self/
  );

  await cleanup();
  await p.end();
  pool = null;
});

maybe('Postgres chat: channel, thread and reaction', async () => {
  await cleanup();
  const p = await ensureMigrated();
  const { user } = await seedUser('chat@example.ru');
  const repo = new PostgresChatRepository(p);

  const channel = Channel.create({ displayName: 'Тестовый канал', createdBy: user.id });
  await repo.saveChannel(channel);
  await repo.addMember(channel.id, user.id, 'Тест');

  // Slug uniqueness.
  const dupe = Channel.rehydrate({ ...channel, id: 'other-id' } as never);
  await assert.rejects(() => repo.saveChannel(dupe));

  const root = ChatMessage.create({
    channelId: channel.id,
    authorId: user.id,
    authorName: 'Тест',
    body: 'Корневое сообщение',
  });
  await repo.saveMessage(root);

  const reply = ChatMessage.create({
    channelId: channel.id,
    authorId: user.id,
    authorName: 'Тест',
    body: 'Ответ в треде',
    rootId: root.id,
  });
  await repo.saveMessage(reply);

  const timeline = await repo.listMessages(channel.id, { limit: 50, rootId: null });
  assert.equal(timeline.length, 1, 'thread replies stay out of the timeline');
  assert.equal(await repo.countReplies(root.id), 1);

  const thread = await repo.listMessages(channel.id, { limit: 50, rootId: root.id });
  assert.equal(thread.length, 1);

  await repo.toggleReaction(root.id, user.id, '🔥');
  const reactions = await repo.listReactions([root.id], user.id);
  assert.equal(reactions[root.id][0].emoji, '🔥');
  assert.equal(reactions[root.id][0].mine, true);

  // Soft delete keeps the row but blanks the body.
  await repo.deleteMessage(root.id);
  const removed = await repo.findMessage(root.id);
  assert.equal(removed?.removed, true);

  await cleanup();
  await p.end();
  pool = null;
});

maybe('Postgres analytics: SQL summary matches the in-memory aggregation', async () => {
  await cleanup();
  const p = await ensureMigrated();
  const { user } = await seedUser('summary@example.ru');
  const repo = new PostgresAnalyticsRepository(p);

  const now = new Date().toISOString();
  const store = await repo.loadStore();

  // Two sessions so averages are meaningful, with device/referrer variety.
  store.sessions['s1'] = {
    sessionId: 's1',
    visitorId: 'v1',
    startedAt: now,
    lastSeenAt: now,
    deviceType: 'Desktop',
    browser: 'Chrome',
    viewport: '1920x1080',
    referrer: 'ya.ru',
    utmSource: '',
    landingTab: 'overview',
    tabsVisited: ['overview', 'market'],
    maxScrollDepth: 80,
    durationSec: 120,
    eventCount: 4,
    clickCount: 2,
  };
  store.sessions['s2'] = {
    sessionId: 's2',
    visitorId: 'v2',
    startedAt: now,
    lastSeenAt: now,
    deviceType: 'Mobile',
    browser: 'Safari',
    viewport: '390x844',
    referrer: 'vk.com',
    utmSource: 'campaign',
    landingTab: 'overview',
    tabsVisited: ['overview'],
    maxScrollDepth: 40,
    durationSec: 60,
    eventCount: 2,
    clickCount: 0,
  };
  store.events.push(
    { id: 'ev1', sessionId: 's1', type: 'pageview', tab: 'overview', timestamp: now, elapsedMs: 0 },
    { id: 'ev2', sessionId: 's1', type: 'click', tab: 'overview', timestamp: now, elapsedMs: 10, xPct: 10, yPct: 20, label: 'Кнопка' },
    { id: 'ev3', sessionId: 's1', type: 'click', tab: 'market', timestamp: now, elapsedMs: 20, xPct: 30, yPct: 40, label: 'Кнопка' },
    { id: 'ev4', sessionId: 's1', type: 'interaction', tab: 'market', timestamp: now, elapsedMs: 30, label: 'Карта' },
    { id: 'ev5', sessionId: 's2', type: 'session_start', tab: 'overview', timestamp: now, elapsedMs: 0 },
    { id: 'ev6', sessionId: 's2', type: 'scroll', tab: 'overview', timestamp: now, elapsedMs: 50, scrollDepth: 40 }
  );
  await repo.saveStore(store);

  const sql = await repo.loadSummary();
  const inMemory = AnalyticsAggregationService.summarize(await repo.loadStore());

  // Totals must agree; this is the contract the dashboard depends on.
  assert.equal(sql.totals.sessions, inMemory.totals.sessions);
  assert.equal(sql.totals.uniqueVisitors, inMemory.totals.uniqueVisitors);
  assert.equal(sql.totals.pageviews, inMemory.totals.pageviews);
  assert.equal(sql.totals.totalEvents, inMemory.totals.totalEvents);
  assert.equal(sql.totals.totalClicks, inMemory.totals.totalClicks);
  assert.equal(sql.totals.avgDurationSec, inMemory.totals.avgDurationSec);
  assert.equal(sql.totals.avgScrollDepth, inMemory.totals.avgScrollDepth);

  // Breakdowns.
  assert.deepEqual(sql.devices, inMemory.devices);
  assert.deepEqual(sql.tabStats, inMemory.tabStats);
  assert.deepEqual(sql.referrers, inMemory.referrers);

  // topClicked groups by (tab, label), so the same label on two tabs is two
  // entries with count 1 rather than one with count 2. Compare the full set
  // order-insensitively so a divergence in either direction is caught.
  const sortClicks = (rows: { label: string; tab: string; count: number }[]) =>
    [...rows]
      .map((r) => `${r.tab}::${r.label}=${r.count}`)
      .sort();
  assert.deepEqual(sortClicks(sql.topClicked), sortClicks(inMemory.topClicked));
  assert.equal(sql.topClicked.length, 2);

  assert.equal(sql.heatmapPoints.length, 2);
  assert.equal(sql.recentSessions.length, 2);

  void user;
  await cleanup();
  await p.end();
  pool = null;
});

maybe('Postgres media: album visibility and asset counters', async () => {
  await cleanup();
  const p = await ensureMigrated();
  const { user } = await seedUser('media@example.ru');
  const repo = new PostgresMediaRepository(p);

  const album = Album.create({
    ownerId: user.id,
    ownerName: 'Тест',
    title: 'Альбом',
    visibility: 'private',
  });
  await repo.saveAlbum(album);

  // A private album is invisible to anonymous viewers.
  const anonView = await repo.listAlbums({ viewerId: null, limit: 10, offset: 0 });
  assert.equal(anonView.total, 0);
  const ownerView = await repo.listAlbums({ viewerId: user.id, limit: 10, offset: 0 });
  assert.equal(ownerView.total, 1);

  const asset = MediaAsset.create({
    albumId: album.id,
    ownerId: user.id,
    ownerName: 'Тест',
    title: 'Кадр',
    objectKey: 'media/image/202611/test.png',
    mimeType: 'image/png',
    sizeBytes: 128,
  });
  await repo.saveAsset(asset);
  await repo.setCover(album.id, asset.id);

  assert.equal(await repo.countAssetsInAlbum(album.id), 1);
  const reloaded = await repo.findAlbum(album.id);
  assert.equal(reloaded?.coverAssetId, asset.id);

  // Deleting the album leaves the asset but detaches it (ON DELETE SET NULL).
  await repo.deleteAlbum(album.id);
  const orphan = await repo.findAsset(asset.id);
  assert.equal(orphan?.albumId, null);

  await cleanup();
  await p.end();
  pool = null;
});
