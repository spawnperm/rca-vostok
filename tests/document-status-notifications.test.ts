import assert from 'node:assert/strict';
import test from 'node:test';
import type { SessionUser } from '../src/utils/identityApi.ts';
import type { InquiryRecord } from '../src/components/social/MyInquiriesSection.tsx';
import { buildDocumentStatusNotifications } from '../src/utils/documentStatusNotifications.ts';

const USER: SessionUser = {
  id: 'u-1',
  email: 'candidate@example.ru',
  fullName: 'Смирнова Ольга Ивановна',
  region: 'Приморский край',
  organisation: 'Турклуб «Восток»',
  role: 'candidate',
  permissions: ['inquiries:view_own'],
  isActive: true,
  createdAt: '2026-10-01T00:00:00Z',
  lastLoginAt: null,
};

test('buildDocumentStatusNotifications: provides public flow statuses when unauthenticated', () => {
  const items = buildDocumentStatusNotifications({
    user: null,
    inquiries: [],
  });

  assert.equal(items.length, 3);
  assert.ok(items.some((i) => i.title.includes('Заявка принята')));
  assert.ok(items.some((i) => i.title.includes('Назначена дата экзамена')));
  assert.ok(items.every((i) => !i.isPersonal));
});

test('buildDocumentStatusNotifications: maps inquiry statuses and selected exam date for candidate', () => {
  const inquiries: InquiryRecord[] = [
    {
      id: 'inq-10',
      fullName: USER.fullName,
      email: USER.email,
      contactChannel: '@smirnova',
      region: USER.region,
      track: 'Пешеходный туризм',
      experienceNote: '2 похода 2 КС',
      consentAccepted: true,
      userId: USER.id,
      status: 'new',
      createdAt: '2026-11-20T09:00:00Z',
    },
    {
      id: 'inq-11',
      fullName: USER.fullName,
      email: USER.email,
      contactChannel: '@smirnova',
      region: USER.region,
      track: 'Водный туризм',
      experienceNote: 'Сплав 2 КС',
      consentAccepted: true,
      userId: USER.id,
      status: 'approved',
      createdAt: '2026-11-10T09:00:00Z',
    },
  ];

  const items = buildDocumentStatusNotifications({
    user: USER,
    inquiries,
    examDateIso: '2027-04-16',
  });

  assert.ok(items.some((i) => i.title === 'Заявка принята'));
  assert.ok(items.some((i) => i.title === 'Комплект документов одобрен'));
  assert.ok(items.some((i) => i.title === 'Назначена дата экзамена: 16 апреля 2027'));
  assert.ok(items.every((i) => i.isPersonal));
});
