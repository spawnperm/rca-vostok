import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ChatMessage, Channel, assertReactionEmoji } from '../src/domain/chat/Chat.ts';
import { Album, MediaAsset, MAX_IMAGE_BYTES } from '../src/domain/media/MediaLibrary.ts';
import { Comment, Post } from '../src/domain/social/Post.ts';
import { SocialProfile } from '../src/domain/social/SocialProfile.ts';
import { ValidationError, InvariantViolationError } from '../src/domain/shared/DomainError.ts';
import {
  PERMISSIONS,
  ROLES,
  roleHasPermission,
} from '../src/domain/identity/Rbac.ts';
import { parseOrThrow, createPostSchema, feedQuerySchema } from '../src/application/social/SocialUseCases.ts';

// ── Social: posts and blog ──────────────────────────────────────────────────

test('Post: short update needs only a body', () => {
  const post = Post.create({
    authorId: 'u1',
    authorName: 'Иван',
    body: 'Открыт зимний сезон на хребте.',
  });
  assert.equal(post.kind, 'update');
  assert.equal(post.status, 'published');
  assert.ok(post.publishedAt);
  assert.ok(post.excerpt.length > 0);
});

test('Post: an article requires a title and a substantial body', () => {
  assert.throws(
    () =>
      Post.create({
        authorId: 'u1',
        authorName: 'Иван',
        kind: 'article',
        title: '',
        body: 'x'.repeat(300),
      }),
    ValidationError
  );

  assert.throws(
    () =>
      Post.create({
        authorId: 'u1',
        authorName: 'Иван',
        kind: 'article',
        title: 'Маршрут',
        body: 'слишком коротко',
      }),
    ValidationError
  );

  const ok = Post.create({
    authorId: 'u1',
    authorName: 'Иван',
    kind: 'article',
    title: 'Маршрут по Сихотэ-Алиню',
    body: 'Подробный разбор маршрута. '.repeat(20),
  });
  assert.equal(ok.kind, 'article');
  assert.equal(ok.title, 'Маршрут по Сихотэ-Алиню');
});

test('Post: drafts are not published and tags are normalised', () => {
  const draft = Post.create({
    authorId: 'u1',
    authorName: 'Иван',
    body: 'Черновик заметки',
    publish: false,
    tags: ['#Туризм', 'туризм', 'Приморье', ''],
  });

  assert.equal(draft.status, 'draft');
  assert.equal(draft.publishedAt, null);
  // Deduplicated case-insensitively, leading # stripped, empty dropped.
  assert.deepEqual([...draft.tags], ['туризм', 'приморье']);
});

test('Post: more than 8 tags is rejected', () => {
  assert.throws(
    () =>
      Post.create({
        authorId: 'u1',
        authorName: 'Иван',
        body: 'Запись с тегами',
        tags: Array.from({ length: 9 }, (_, i) => `tag${i}`),
      }),
    ValidationError
  );
});

test('Post: only the author may edit; removed posts are frozen', () => {
  const post = Post.create({ authorId: 'u1', authorName: 'Иван', body: 'Исходный текст' });

  assert.throws(() => post.assertAuthoredBy('u2'), InvariantViolationError);

  const edited = post.edit({ body: 'Обновлённый текст' });
  assert.equal(edited.body, 'Обновлённый текст');
  assert.equal(edited.id, post.id);
  assert.ok(edited.updatedAt >= post.updatedAt);
});

test('Comment: rejects empty body and keeps author', () => {
  assert.throws(
    () => Comment.create({ postId: 'p1', authorId: 'u1', authorName: 'Иван', body: '   ' }),
    ValidationError
  );

  const comment = Comment.create({
    postId: 'p1',
    authorId: 'u1',
    authorName: 'Иван',
    body: 'Полезная статья!',
  });
  assert.equal(comment.postId, 'p1');
  assert.equal(comment.body, 'Полезная статья!');
});

test('SocialProfile: website must be a well-formed http(s) URL', () => {
  const profile = SocialProfile.createDefault({
    userId: 'u1',
    displayName: 'Иван',
    region: 'Приморский край',
    organisation: '',
    role: ROLES.CANDIDATE,
  });

  assert.equal(profile.update({ websiteUrl: 'https://example.ru' }).websiteUrl, 'https://example.ru');
  assert.equal(profile.update({ websiteUrl: 'javascript:alert(1)' }).websiteUrl, '');
  assert.equal(profile.update({ websiteUrl: 'not a url' }).websiteUrl, '');
});

test('SocialProfile: skills are deduplicated and capped', () => {
  const profile = SocialProfile.createDefault({
    userId: 'u1',
    displayName: 'Иван',
    region: '',
    organisation: '',
    role: ROLES.CANDIDATE,
  });

  const updated = profile.update({
    skills: ['Водный туризм', 'Водный туризм', ...Array.from({ length: 20 }, (_, i) => `s${i}`)],
  });
  assert.ok(updated.skills.length <= 12);
  assert.equal(updated.skills.filter((s) => s === 'Водный туризм').length, 1);
});

test('SocialProfile: validates avatarUrl, coverUrl, contacts and editable profile fields', () => {
  const profile = SocialProfile.createDefault({
    userId: 'u1',
    displayName: 'Иван Петров',
    region: 'Приморский край',
    organisation: '',
    role: ROLES.CANDIDATE,
  });

  const updated = profile.update({
    displayName: 'Смирнов Александр Анатольевич',
    region: 'Камчатский край',
    organisation: 'Турклуб Восток',
    phone: '+7 (914) 555-01-02',
    telegram: 't.me/vostok_guide',
    publicEmail: 'contact@vostok-guide.ru',
    vkUrl: 'vk.com/vostok_guide',
    avatarUrl: '/src/assets/images/guide_portrait_taiga_1795488166052.jpg',
    coverUrl: '/media/asset-cover-1',
  });

  assert.equal(updated.displayName, 'Смирнов Александр Анатольевич');
  assert.equal(updated.region, 'Камчатский край');
  assert.equal(updated.organisation, 'Турклуб Восток');
  assert.equal(updated.phone, '+7 (914) 555-01-02');
  assert.equal(updated.telegram, '@vostok_guide');
  assert.equal(updated.publicEmail, 'contact@vostok-guide.ru');
  assert.equal(updated.vkUrl, 'https://vk.com/vostok_guide');
  assert.equal(updated.avatarUrl, '/src/assets/images/guide_portrait_taiga_1795488166052.jpg');
  assert.equal(updated.coverUrl, '/media/asset-cover-1');

  assert.throws(
    () => profile.update({ avatarUrl: 'javascript:alert(1)' }),
    ValidationError
  );
  assert.throws(
    () => profile.update({ coverUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }),
    ValidationError
  );
  assert.throws(
    () => profile.update({ vkUrl: 'javascript:alert(1)' }),
    ValidationError
  );
});

// ── Chat ────────────────────────────────────────────────────────────────────

test('Channel: slug is transliterated from the Russian name', () => {
  const channel = Channel.create({
    displayName: 'Пешие походы',
    createdBy: 'u1',
    type: 'public',
  });
  assert.equal(channel.slug, 'peshie-pohody');
  assert.equal(channel.type, 'public');
});

test('Channel: name is required and bounded', () => {
  assert.throws(() => Channel.create({ displayName: 'x', createdBy: 'u1' }), ValidationError);
});

test('ChatMessage: body is validated and threads keep rootId', () => {
  assert.throws(
    () => ChatMessage.create({ channelId: 'c1', authorId: 'u1', authorName: 'A', body: '  ' }),
    ValidationError
  );

  const message = ChatMessage.create({
    channelId: 'c1',
    authorId: 'u1',
    authorName: 'Иван',
    body: 'Привет',
    rootId: 'msg-root',
  });
  assert.equal(message.rootId, 'msg-root');
});

test('ChatMessage: only the author edits; removal is soft and respects moderators', () => {
  const message = ChatMessage.create({
    channelId: 'c1',
    authorId: 'u1',
    authorName: 'Иван',
    body: 'Исходный',
  });

  assert.throws(() => message.edit('u2', 'взлом'), InvariantViolationError);

  const edited = message.edit('u1', 'Исправленный');
  assert.equal(edited.body, 'Исправленный');
  assert.ok(edited.editedAt);

  // A non-author without moderation rights cannot delete.
  assert.throws(() => message.remove('u2', false), InvariantViolationError);

  // A moderator can.
  const removed = message.remove('u2', true);
  assert.equal(removed.removed, true);
  assert.equal(removed.body, '');
});

test('Reactions: only allowlisted emoji are accepted', () => {
  assert.equal(assertReactionEmoji('👍'), '👍');
  assert.throws(() => assertReactionEmoji('💩'), ValidationError);
  assert.throws(() => assertReactionEmoji(''), ValidationError);
});

// ── Media ───────────────────────────────────────────────────────────────────

test('Album: title required, private visibility honoured', () => {
  assert.throws(
    () => Album.create({ ownerId: 'u1', ownerName: 'Иван', title: 'x' }),
    ValidationError
  );

  const album = Album.create({
    ownerId: 'u1',
    ownerName: 'Иван',
    title: 'Сихотэ-Алинь 2026',
    visibility: 'private',
  });
  assert.equal(album.visibility, 'private');
  assert.throws(() => album.assertAccessibleBy('u2'), InvariantViolationError);
  assert.doesNotThrow(() => album.assertAccessibleBy('u1'));
});

test('MediaAsset: kind is inferred from MIME and unsupported types rejected', () => {
  const image = MediaAsset.create({
    ownerId: 'u1',
    ownerName: 'Иван',
    objectKey: 'media/image/202601/abc.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
  });
  assert.equal(image.kind, 'image');

  const video = MediaAsset.create({
    ownerId: 'u1',
    ownerName: 'Иван',
    objectKey: 'media/video/202601/abc.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 5_000_000,
  });
  assert.equal(video.kind, 'video');

  assert.throws(
    () =>
      MediaAsset.create({
        ownerId: 'u1',
        ownerName: 'Иван',
        objectKey: 'x',
        mimeType: 'application/pdf',
        sizeBytes: 100,
      }),
    ValidationError
  );
});

test('MediaAsset: per-kind size limits are enforced', () => {
  assert.throws(
    () =>
      MediaAsset.create({
        ownerId: 'u1',
        ownerName: 'Иван',
        objectKey: 'x.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: MAX_IMAGE_BYTES + 1,
      }),
    ValidationError
  );

  assert.throws(
    () =>
      MediaAsset.create({
        ownerId: 'u1',
        ownerName: 'Иван',
        objectKey: 'x.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 0,
      }),
    ValidationError
  );
});

// ── RBAC for the new capabilities ───────────────────────────────────────────

test('RBAC: candidates can participate socially but cannot moderate', () => {
  assert.equal(roleHasPermission(ROLES.CANDIDATE, PERMISSIONS.PUBLISH_POST), true);
  assert.equal(roleHasPermission(ROLES.CANDIDATE, PERMISSIONS.USE_CHAT), true);
  assert.equal(roleHasPermission(ROLES.CANDIDATE, PERMISSIONS.UPLOAD_MEDIA), true);
  assert.equal(roleHasPermission(ROLES.CANDIDATE, PERMISSIONS.MODERATE_CONTENT), false);
  assert.equal(roleHasPermission(ROLES.CANDIDATE, PERMISSIONS.CREATE_CHANNEL), false);
  assert.equal(roleHasPermission(ROLES.CANDIDATE, PERMISSIONS.MODERATE_MEDIA), false);
});

test('RBAC: curators moderate content and chat but cannot manage users', () => {
  assert.equal(roleHasPermission(ROLES.CURATOR, PERMISSIONS.MODERATE_CONTENT), true);
  assert.equal(roleHasPermission(ROLES.CURATOR, PERMISSIONS.CREATE_CHANNEL), true);
  assert.equal(roleHasPermission(ROLES.CURATOR, PERMISSIONS.MODERATE_MEDIA), true);
  assert.equal(roleHasPermission(ROLES.CURATOR, PERMISSIONS.MANAGE_USERS), false);
});

// ── Zod boundary validation ─────────────────────────────────────────────────

test('Zod: createPost rejects an oversized body and unknown kind', () => {
  assert.throws(
    () => parseOrThrow(createPostSchema, { body: 'x'.repeat(60001) }),
    ValidationError
  );
  assert.throws(
    () => parseOrThrow(createPostSchema, { body: 'ok', kind: 'poll' }),
    ValidationError
  );
});

test('Zod: feed query coerces and bounds pagination', () => {
  const parsed = parseOrThrow(feedQuerySchema, { limit: '10', offset: '0' });
  assert.equal(parsed.limit, 10);
  assert.equal(parsed.offset, 0);

  // Out-of-range values are rejected rather than silently clamped.
  assert.throws(() => parseOrThrow(feedQuerySchema, { limit: '999' }), ValidationError);
});

test('Zod: error message names the offending field', () => {
  try {
    parseOrThrow(createPostSchema, { body: '' });
    assert.fail('expected ValidationError');
  } catch (err) {
    assert.ok(err instanceof ValidationError);
    assert.match(err.message, /body/);
  }
});
