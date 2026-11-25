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
import { ScryptPasswordHasher } from '../src/infrastructure/security/ScryptPasswordHasher.ts';
import { User } from '../src/domain/identity/User.ts';
import { ROLES } from '../src/domain/identity/Rbac.ts';
import { Post } from '../src/domain/social/Post.ts';
import { InvariantViolationError, NotFoundError } from '../src/domain/shared/DomainError.ts';
import {
  CreatePostUseCase,
  DeletePostUseCase,
  GetPostUseCase,
  ListActivityUseCase,
  UpdatePostUseCase,
} from '../src/application/social/SocialUseCases.ts';
import {
  CreateChannelUseCase,
  DeleteMessageUseCase,
  EditMessageUseCase,
  ListMessagesUseCase,
  SendMessageUseCase,
} from '../src/application/chat/ChatUseCases.ts';
import {
  CreateAlbumUseCase,
  DeleteAlbumUseCase,
} from '../src/application/media/MediaUseCases.ts';

async function makeUser(
  email: string,
  fullName: string,
  role: 'candidate' | 'curator'
): Promise<User> {
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

test('CMS: Post.edit transitions draft -> published -> draft cleanly', () => {
  const draft = Post.create({
    authorId: 'u1',
    authorName: 'Куратор',
    kind: 'news',
    title: 'Черновик новости',
    body: 'Текст черновика новости достаточной длины для публикации на главной.',
    publish: false,
  });
  assert.equal(draft.status, 'draft');
  assert.equal(draft.publishedAt, null);

  const published = draft.edit({ publish: true, title: 'Опубликованная новость' });
  assert.equal(published.status, 'published');
  assert.equal(published.title, 'Опубликованная новость');
  assert.ok(published.publishedAt);

  const unpublished = published.edit({ publish: false });
  assert.equal(unpublished.status, 'draft');
  assert.equal(unpublished.publishedAt, null);
});

test('CMS: CreatePostUseCase/UpdatePostUseCase/GetPostUseCase handle drafts, news activity, edit & delete', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-cms-'));
  try {
    const socialRepo = new JsonFileSocialRepository(dir);
    const bus = new InMemoryDomainEventBus();

    const candidate = await makeUser('author@example.ru', 'Автор', ROLES.CANDIDATE);
    const curator = await makeUser('curator@example.ru', 'Куратор', ROLES.CURATOR);

    const createPost = new CreatePostUseCase(socialRepo, bus);
    const updatePost = new UpdatePostUseCase(socialRepo);
    const deletePost = new DeletePostUseCase(socialRepo);
    const getPost = new GetPostUseCase(socialRepo);
    const listActivity = new ListActivityUseCase(socialRepo);

    const draft = await createPost.execute(curator, {
      kind: 'news',
      title: 'Срочный сбор комиссии',
      body: 'Выездная комиссия соберётся в кампусе ВВГУ для приёма практической части.',
      publish: false,
    });
    assert.equal(draft.status, 'draft');

    // Non-author candidate cannot read another user's draft directly.
    await assert.rejects(() => getPost.execute(draft.id, candidate), NotFoundError);
    // Author can open their own draft.
    const ownView = await getPost.execute(draft.id, curator);
    assert.equal(ownView.post.status, 'draft');

    // Publishing the draft transitions status and records news activity.
    const published = await updatePost.execute(curator, draft.id, {
      body: 'Выездная комиссия соберётся в кампусе ВВГУ 15 мая для приёма практической части.',
      publish: true,
    });
    assert.equal(published.status, 'published');
    assert.ok(published.publishedAt);

    const activity = await listActivity.execute(curator, 10);
    assert.ok(activity.some((a) => a.summary.includes('Опубликована новость')));

    // Soft-delete hides post from reads.
    await deletePost.execute(curator, draft.id);
    await assert.rejects(() => getPost.execute(draft.id, curator), NotFoundError);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Chat: public seeded channel allows immediate send without pre-join, while private enforces membership and edit/delete work', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-chat-cms-'));
  try {
    const chatRepo = new JsonFileChatRepository(dir);
    const bus = new InMemoryDomainEventBus();

    const candidate = await makeUser('chat1@example.ru', 'Иван Петров', ROLES.CANDIDATE);
    const curator = await makeUser('chat2@example.ru', 'Анна Куратор', ROLES.CURATOR);

    const sendMessage = new SendMessageUseCase(chatRepo, bus);
    const editMessage = new EditMessageUseCase(chatRepo);
    const deleteMessage = new DeleteMessageUseCase(chatRepo);
    const createChannel = new CreateChannelUseCase(chatRepo);
    const listMessages = new ListMessagesUseCase(chatRepo);

    // Seeded public channel: sending works immediately on first message.
    const msg = await sendMessage.execute(candidate, 'chn-general-dfo', {
      body: 'Приветствую коллег на Дальнем Востоке!',
    });
    assert.equal(msg.body, 'Приветствую коллег на Дальнем Востоке!');

    const edited = await editMessage.execute(candidate, msg.id, {
      body: 'Приветствую коллег в Приморье и ДФО!',
    });
    assert.equal(edited.body, 'Приветствую коллег в Приморье и ДФО!');
    assert.ok(edited.editedAt);

    // Moderator deletes message softly.
    await deleteMessage.execute(curator, msg.id);
    const timeline = await listMessages.execute(curator, 'chn-general-dfo', {});
    assert.equal(timeline.messages[0].body, '');

    // Private channel still rejects non-members with NOT_A_MEMBER.
    const priv = await createChannel.execute(curator, {
      displayName: 'Комиссия закрытый',
      type: 'private',
    });
    await assert.rejects(
      () => sendMessage.execute(candidate, priv.id, { body: 'Попытка без доступа' }),
      (err: unknown) => err instanceof Error && 'code' in err && err.code === 'NOT_A_MEMBER'
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Media: DeleteAlbumUseCase enforces ownership and allows media moderators', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-media-del-'));
  try {
    const mediaRepo = new JsonFileMediaRepository(dir);
    new LocalObjectStorage(path.join(dir, 'objects'));
    const bus = new InMemoryDomainEventBus();

    const owner = await makeUser('m1@example.ru', 'Владелец', ROLES.CANDIDATE);
    const stranger = await makeUser('m2@example.ru', 'Участник', ROLES.CANDIDATE);
    const curator = await makeUser('m3@example.ru', 'Модератор', ROLES.CURATOR);

    const createAlbum = new CreateAlbumUseCase(mediaRepo, bus);
    const deleteAlbum = new DeleteAlbumUseCase(mediaRepo);

    const alb1 = await createAlbum.execute(owner, { title: 'Камчатка фото' });
    await assert.rejects(() => deleteAlbum.execute(stranger, alb1.id), InvariantViolationError);
    await deleteAlbum.execute(curator, alb1.id);
    assert.equal(await mediaRepo.findAlbum(alb1.id), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
