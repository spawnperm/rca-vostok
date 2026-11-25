import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  computeInquiryStatusCounts,
  computeInquiryYearCounts,
  filterAndSortInquiriesHistory,
  getAvailableInquiryYears,
  getInquirySubmissionYear,
} from '../src/utils/inquiriesHistoryFilter.ts';
import { buildApplicationProgressModel } from '../src/utils/applicationProgress.ts';
import type { InquiryRecord } from '../src/components/social/MyInquiriesSection.tsx';

function makeInquiry(
  id: string,
  status: InquiryRecord['status'],
  createdAt: string,
  sessionDate?: string
): InquiryRecord {
  return {
    id,
    fullName: 'Иванов Алексей Петрович',
    email: 'ivanov@example.ru',
    contactChannel: '@ivanov_dv',
    region: 'Приморский край',
    track: 'Пешеходный туризм',
    experienceNote: '2–3 КС Приморье',
    consentAccepted: true,
    sessionDate: sessionDate ?? null,
    userId: 'usr-1',
    status,
    createdAt,
  };
}

const SAMPLE_INQUIRIES: InquiryRecord[] = [
  makeInquiry('inq-1', 'rejected', '2025-03-14T09:00:00.000Z', '2025-04-20'),
  makeInquiry('inq-2', 'approved', '2025-08-22T11:30:00.000Z', '2025-09-15'),
  makeInquiry('inq-3', 'needs_documents', '2026-02-10T14:00:00.000Z', '2026-04-16'),
  makeInquiry('inq-4', 'in_review', '2026-11-02T10:15:00.000Z', '2027-04-16'),
  makeInquiry('inq-5', 'new', '2027-01-18T08:45:00.000Z', '2027-05-20'),
];

describe('Inquiries history filtering by year and status & 4-stage attestation progress bar', () => {
  it('extracts available years sorted descending and computes year & status counts', () => {
    assert.equal(getInquirySubmissionYear(SAMPLE_INQUIRIES[0]), 2025);
    assert.deepEqual(getAvailableInquiryYears(SAMPLE_INQUIRIES), [2027, 2026, 2025]);

    const yearCounts = computeInquiryYearCounts(SAMPLE_INQUIRIES);
    assert.equal(yearCounts.get(2025), 2);
    assert.equal(yearCounts.get(2026), 2);
    assert.equal(yearCounts.get(2027), 1);

    const status2025 = computeInquiryStatusCounts(SAMPLE_INQUIRIES, 2025);
    assert.equal(status2025.all, 2);
    assert.equal(status2025.approved, 1);
    assert.equal(status2025.rejected, 1);
    assert.equal(status2025.in_review, 0);
  });

  it('filters inquiries by combined year and status and supports newest/oldest sorting', () => {
    const newestAll = filterAndSortInquiriesHistory(SAMPLE_INQUIRIES, {
      year: 'all',
      status: 'all',
      sortOrder: 'newest',
    });
    assert.deepEqual(
      newestAll.map((i) => i.id),
      ['inq-5', 'inq-4', 'inq-3', 'inq-2', 'inq-1']
    );

    const oldest2025 = filterAndSortInquiriesHistory(SAMPLE_INQUIRIES, {
      year: 2025,
      status: 'all',
      sortOrder: 'oldest',
    });
    assert.deepEqual(
      oldest2025.map((i) => i.id),
      ['inq-1', 'inq-2']
    );

    const approved2025 = filterAndSortInquiriesHistory(SAMPLE_INQUIRIES, {
      year: 2025,
      status: 'approved',
    });
    assert.equal(approved2025.length, 1);
    assert.equal(approved2025[0].id, 'inq-2');

    const emptyCombo = filterAndSortInquiriesHistory(SAMPLE_INQUIRIES, {
      year: 2027,
      status: 'approved',
    });
    assert.equal(emptyCombo.length, 0);
  });

  it('exposes the 4 canonical attestation progress stages across statuses', () => {
    const model = buildApplicationProgressModel({
      userRole: 'candidate',
      activeInquiry: SAMPLE_INQUIRIES[3], // in_review
    });

    assert.deepEqual(
      model.steps.map((s) => s.title),
      ['Заявка подана', 'Документы проверены', 'К тестированию готов', 'Аттестован']
    );
    assert.equal(model.steps[0].state, 'completed');
    assert.equal(model.steps[1].state, 'completed');
    assert.equal(model.steps[2].state, 'current');
    assert.equal(model.steps[3].state, 'pending');
    assert.equal(model.progressPercent, 55);
  });
});
