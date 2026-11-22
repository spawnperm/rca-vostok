import assert from 'node:assert/strict';
import test from 'node:test';
import { Post } from '../src/domain/social/Post.ts';
import { ValidationError } from '../src/domain/shared/DomainError.ts';

// News published from the cabinet is surfaced on the public landing page, so
// its rules differ from a feed update: a headline is mandatory and the body has
// a higher floor than a casual post.

test('Post(news): requires a heading', () => {
  assert.throws(
    () =>
      Post.create({
        authorId: 'u1',
        authorName: 'Куратор',
        kind: 'news',
        title: '',
        body: 'Короткая, но достаточная по длине новость для проверки правила.',
      }),
    ValidationError
  );
});

test('Post(news): body must carry real information (40+ chars)', () => {
  assert.throws(
    () =>
      Post.create({
        authorId: 'u1',
        authorName: 'Куратор',
        kind: 'news',
        title: 'Набор открыт',
        body: 'Слишком коротко',
      }),
    ValidationError
  );
});

test('Post(news): a valid news item is published immediately', () => {
  const news = Post.create({
    authorId: 'u1',
    authorName: 'Куратор',
    kind: 'news',
    title: 'Открыт набор на водный туризм',
    body: 'Центр открыл договорной набор на программу по водному туризму для инструкторов-проводников Приморья.',
    tags: ['набор', 'водный туризм'],
  });

  assert.equal(news.kind, 'news');
  assert.equal(news.status, 'published');
  assert.ok(news.publishedAt);
  assert.ok(news.excerpt.length > 0);
  assert.deepEqual([...news.tags], ['набор', 'водный туризм']);
});

test('Post(news): drafts stay unpublished and are not on the landing page', () => {
  const draft = Post.create({
    authorId: 'u1',
    authorName: 'Куратор',
    kind: 'news',
    title: 'Черновик новости',
    body: 'Текст новости, которого ещё нет на публичной странице сайта.',
    publish: false,
  });
  assert.equal(draft.status, 'draft');
  assert.equal(draft.publishedAt, null);
});

test('Post(news): editing keeps the news rules', () => {
  const news = Post.create({
    authorId: 'u1',
    authorName: 'Куратор',
    kind: 'news',
    title: 'Заголовок',
    body: 'Достаточно длинный текст новости для успешного создания записи.',
  });

  // Blanking the title is rejected for news, unlike a plain update.
  assert.throws(() => news.edit({ title: '' }), ValidationError);

  const edited = news.edit({ body: 'Обновлённый текст новости с новыми подробностями.' });
  assert.equal(edited.kind, 'news');
  assert.ok(edited.updatedAt >= news.updatedAt);
});

test('Post(update): a plain update still needs no heading', () => {
  const update = Post.create({
    authorId: 'u1',
    authorName: 'Участник',
    body: 'Короткая запись в ленте.',
  });
  assert.equal(update.kind, 'update');
  assert.equal(update.title, '');
});

test('Post: unknown kind degrades to update instead of throwing', () => {
  const post = Post.create({
    authorId: 'u1',
    authorName: 'Участник',
    kind: 'announcement' as never,
    body: 'Текст записи',
  });
  assert.equal(post.kind, 'update');
});
