import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { InMemoryDomainEventBus } from '../src/infrastructure/events/InMemoryDomainEventBus.ts';
import { JsonFileSocialRepository } from '../src/infrastructure/persistence/JsonFileSocialRepository.ts';
import { JsonFileChatRepository } from '../src/infrastructure/persistence/JsonFileChatRepository.ts';
import { JsonFileMediaRepository } from '../src/infrastructure/persistence/JsonFileMediaRepository.ts';
import { LocalObjectStorage } from '../src/infrastructure/storage/GarageObjectStorage.ts';
import { InMemoryUserRepository } from '../src/infrastructure/persistence/InMemoryIdentityRepositories.ts';
import { ScryptPasswordHasher } from '../src/infrastructure/security/ScryptPasswordHasher.ts';
import { User } from '../src/domain/identity/User.ts';
import { ROLES } from '../src/domain/identity/Rbac.ts';
import {
  AddCommentUseCase,
  CreatePostUseCase,
  FollowUserUseCase,
  GetPostUseCase,
  GetSocialProfileUseCase,
  ListActivityUseCase,
  ListFeedUseCase,
  ToggleLikeUseCase,
  UpdateSocialProfileUseCase,
} from '../src/application/social/SocialUseCases.ts';
import {
  CreateChannelUseCase,
  JoinChannelUseCase,
  ListChannelsUseCase,
  ListMessagesUseCase,
  SendMessageUseCase,
  ToggleReactionUseCase,
} from '../src/application/chat/ChatUseCases.ts';
import {
  CreateAlbumUseCase,
  DeleteAssetUseCase,
  ListAlbumsUseCase,
  ListAssetsUseCase,
  RegisterAssetUseCase,
} from '../src/application/media/MediaUseCases.ts';

async function makeUser(email: string, fullName: string, role: 'candidate' | 'curator'): Promise<User> {
  const hasher = new ScryptPasswordHasher();
  const draft = User.create({
    email,
    password: 'Password123',
    fullName,
    region: 'Приморский край',
    role,
  });
  const material = await hasher.hash(draft.plainPassword);
  return draft.withPassword(material);
}

test('JsonFileSocialRepository: supports profile editing, posts, comments, likes, follows and activity', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-social-'));
  try {
    const socialRepo = new JsonFileSocialRepository(dir);
    const userRepo = new InMemoryUserRepository();
    const bus = new InMemoryDomainEventBus();

    const candidate = await makeUser('guide1@example.ru', 'Алексей Воробьёв', ROLES.CANDIDATE);
    const curator = await makeUser('curator@example.ru', 'Елена Соколова', ROLES.CURATOR);
    await userRepo.save(candidate);
    await userRepo.save(curator);

    const getProfile = new GetSocialProfileUseCase(socialRepo, userRepo);
    const updateProfile = new UpdateSocialProfileUseCase(socialRepo, userRepo, bus);
    const createPost = new CreatePostUseCase(socialRepo, bus);
    const listFeed = new ListFeedUseCase(socialRepo);
    const getPost = new GetPostUseCase(socialRepo);
    const addComment = new AddCommentUseCase(socialRepo, bus);
    const toggleLike = new ToggleLikeUseCase(socialRepo, bus);
    const followUser = new FollowUserUseCase(socialRepo);
    const listActivity = new ListActivityUseCase(socialRepo);

    const updatedProfile = await updateProfile.execute(candidate, {
      displayName: 'Алексей Воробьёв-ДВ',
      region: 'Сахалинская область',
      organisation: 'Сахалин Трек',
      headline: 'Инструктор водных маршрутов',
      bio: 'Опыт сплавов в Приморье и на Сахалине.',
      phone: '+7 914 111-22-33',
      telegram: '@vorobiev_dv',
      publicEmail: 'alexey@vostok-guide.ru',
      vkUrl: 'https://vk.com/vorobiev_dv',
      websiteUrl: 'https://vostok-guide.ru',
      avatarUrl: '/src/assets/images/guide_portrait_water_1795488167929.jpg',
      coverUrl: '/src/assets/images/river_rafting_taiga_1795333557039.jpg',
      skills: ['Водный туризм', 'Первая помощь'],
    });
    assert.equal(updatedProfile.displayName, 'Алексей Воробьёв-ДВ');
    assert.equal(updatedProfile.region, 'Сахалинская область');
    assert.equal(updatedProfile.organisation, 'Сахалин Трек');
    assert.equal(updatedProfile.headline, 'Инструктор водных маршрутов');
    assert.equal(updatedProfile.phone, '+7 914 111-22-33');
    assert.equal(updatedProfile.telegram, '@vorobiev_dv');
    assert.equal(updatedProfile.publicEmail, 'alexey@vostok-guide.ru');
    assert.equal(updatedProfile.vkUrl, 'https://vk.com/vorobiev_dv');
    assert.equal(updatedProfile.avatarUrl, '/src/assets/images/guide_portrait_water_1795488167929.jpg');
    assert.equal(updatedProfile.coverUrl, '/src/assets/images/river_rafting_taiga_1795333557039.jpg');
    assert.deepEqual(updatedProfile.skills, ['Водный туризм', 'Первая помощь']);

    const syncedIdentityUser = await userRepo.findById(candidate.id);
    assert.equal(syncedIdentityUser?.fullName.value, 'Алексей Воробьёв-ДВ');
    assert.equal(syncedIdentityUser?.region, 'Сахалинская область');
    assert.equal(syncedIdentityUser?.phone, '+7 914 111-22-33');
    assert.equal(syncedIdentityUser?.telegram, '@vorobiev_dv');
    assert.equal(syncedIdentityUser?.avatarUrl, '/src/assets/images/guide_portrait_water_1795488167929.jpg');

    const post = await createPost.execute(candidate, {
      kind: 'article',
      title: 'Прохождение порогов в весенний паводок',
      body: 'Подробный отчёт о прохождении водного маршрута в Приморском крае. '.repeat(6),
      tags: ['Водный', 'Приморье'],
    });
    assert.equal(post.kind, 'article');

    const news = await createPost.execute(curator, {
      kind: 'news',
      title: 'Открыт приём заявок на весеннюю комиссию',
      body: 'Региональный центр аттестации открыл расписание выездных комиссий во Владивостоке.',
    });
    assert.equal(news.kind, 'news');

    await addComment.execute(curator, post.id, { body: 'Отличный разбор безопасности!' });
    const likeRes = await toggleLike.execute(curator, post.id);
    assert.equal(likeRes.liked, true);
    assert.equal(likeRes.count, 1);

    const followRes = await followUser.execute(curator, candidate.id, true);
    assert.equal(followRes.following, true);
    assert.equal(followRes.followerCount, 1);

    const feed = await listFeed.execute({ limit: 10, offset: 0 }, curator);
    assert.equal(feed.total, 2);

    const fullPost = await getPost.execute(post.id);
    assert.equal(fullPost.comments.length, 1);
    assert.equal(fullPost.post.likeCount, 1);
    assert.equal(fullPost.post.commentCount, 1);

    const viewedProfile = await getProfile.execute(curator, candidate.id);
    assert.equal(viewedProfile.isFollowedByMe, true);
    assert.equal(viewedProfile.postCount, 1);

    const activity = await listActivity.execute(candidate, 10);
    assert.equal(activity.length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('JsonFileChatRepository: seeds DFO channels, creates custom channels, sends messages and reactions', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-chat-'));
  try {
    const chatRepo = new JsonFileChatRepository(dir);
    const bus = new InMemoryDomainEventBus();

    const candidate = await makeUser('guide2@example.ru', 'Дмитрий Лесников', ROLES.CANDIDATE);
    const curator = await makeUser('curator2@example.ru', 'Мария Петрова', ROLES.CURATOR);

    const listChannels = new ListChannelsUseCase(chatRepo);
    const createChannel = new CreateChannelUseCase(chatRepo);
    const joinChannel = new JoinChannelUseCase(chatRepo);
    const sendMessage = new SendMessageUseCase(chatRepo, bus);
    const listMessages = new ListMessagesUseCase(chatRepo);
    const toggleReaction = new ToggleReactionUseCase(chatRepo);

    const initialChannels = await listChannels.execute(candidate);
    assert.ok(initialChannels.channels.length >= 3);

    const created = await createChannel.execute(curator, {
      displayName: 'Камчатка 2026',
      purpose: 'Координация маршрутов по вулканам',
    });
    assert.equal(created.displayName, 'Камчатка 2026');

    await joinChannel.execute(candidate, created.id);
    const msg = await sendMessage.execute(candidate, created.id, { body: 'Всем привет в канале!' });
    await sendMessage.execute(curator, created.id, { body: 'Ответ в треде', rootId: msg.id });

    const reaction = await toggleReaction.execute(curator, msg.id, '👍');
    assert.equal(reaction.active, true);

    const timeline = await listMessages.execute(curator, created.id, {});
    assert.equal(timeline.messages.length, 1);
    assert.equal(timeline.messages[0].replyCount, 1);
    assert.equal(timeline.messages[0].reactions[0]?.emoji, '👍');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('JsonFileMediaRepository + LocalObjectStorage: creates albums, stores files with confinement, lists URLs and deletes safely', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-media-'));
  try {
    const mediaRepo = new JsonFileMediaRepository(dir);
    const storage = new LocalObjectStorage(path.join(dir, 'media-objects'));
    const bus = new InMemoryDomainEventBus();

    const candidate = await makeUser('guide3@example.ru', 'Ольга Тихонова', ROLES.CANDIDATE);

    const createAlbum = new CreateAlbumUseCase(mediaRepo, bus);
    const listAlbums = new ListAlbumsUseCase(mediaRepo);
    const registerAsset = new RegisterAssetUseCase(mediaRepo, storage, bus);
    const listAssets = new ListAssetsUseCase(mediaRepo);
    const deleteAsset = new DeleteAssetUseCase(mediaRepo, storage);

    const album = await createAlbum.execute(candidate, {
      title: 'Сихотэ-Алинь',
      description: 'Фотоотчёт с осеннего маршрута',
    });

    const albums = await listAlbums.execute(candidate, {});
    assert.equal(albums.total, 1);

    const payload = Buffer.from('fake-png-bytes');
    const uploaded = await registerAsset.execute(
      candidate,
      {
        albumId: album.id,
        title: 'Перевал.png',
        mimeType: 'image/png',
        sizeBytes: payload.length,
      },
      payload
    );
    assert.equal(uploaded.url, `/media/${uploaded.id}`);

    const listed = await listAssets.execute({ albumId: album.id });
    assert.equal(listed.total, 1);
    assert.equal(listed.assets[0].url, `/media/${uploaded.id}`);

    const stored = await storage.get(uploaded.objectKey);
    assert.ok(stored);
    assert.equal(stored.body.toString(), 'fake-png-bytes');

    // Path traversal keys must be rejected by LocalObjectStorage confinement.
    await assert.rejects(() => storage.put('../escape.txt', payload, 'text/plain'));

    await deleteAsset.execute(candidate, uploaded.id);
    const afterDelete = await listAssets.execute({ albumId: album.id });
    assert.equal(afterDelete.total, 0);
    assert.equal(await storage.get(uploaded.objectKey), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
