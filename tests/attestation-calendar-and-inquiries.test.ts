import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildMonthCalendarGrid,
  filterExamSchedule,
  getDefaultCalendarMonth,
  getInPersonExamSchedule,
  getSessionMonths,
  getUpcomingAttestationSessions,
} from '../src/utils/attestationCalendarBooking.ts';
import { CertificationInquiry } from '../src/domain/certification/CertificationInquiry.ts';
import { ValidationError } from '../src/domain/shared/DomainError.ts';
import { JsonFileInquiryRepository } from '../src/infrastructure/persistence/JsonFileInquiryRepository.ts';
import {
  GetInquiryStatsUseCase,
  SubmitInquiryUseCase,
} from '../src/application/certification/InquiryUseCases.ts';
import { InMemoryDomainEventBus } from '../src/infrastructure/events/InMemoryDomainEventBus.ts';

describe('Attestation Sessions Calendar & Inquiry Status Lifecycle', () => {
  it('builds upcoming sessions list, month jump tabs, and Monday-first calendar grid with booking flags', () => {
    const sessions = getUpcomingAttestationSessions('2026-11-23');
    assert.ok(sessions.length >= 5);
    assert.equal(sessions[0].start, '2027-04-16');

    const months = getSessionMonths(sessions);
    assert.ok(months.some((m) => m.year === 2027 && m.month === 3 && m.sessionCount === 1));

    const defMonth = getDefaultCalendarMonth(sessions);
    assert.deepEqual(defMonth, { year: 2027, month: 3 });

    const booked = new Set(['2027-04-16']);
    const cells = buildMonthCalendarGrid(2027, 3, sessions, booked, '2026-11-23');
    assert.ok(cells.length === 35 || cells.length === 42);

    const sessionStartCell = cells.find((c) => c.isoDate === '2027-04-16');
    const sessionMidCell = cells.find((c) => c.isoDate === '2027-04-17');
    const regularCell = cells.find((c) => c.isoDate === '2027-04-20');

    assert.ok(sessionStartCell);
    assert.equal(sessionStartCell.isSessionStart, true);
    assert.equal(sessionStartCell.isBooked, true);
    assert.equal(sessionStartCell.session?.start, '2027-04-16');

    assert.ok(sessionMidCell);
    assert.equal(sessionMidCell.isBooked, true);

    assert.ok(regularCell);
    assert.equal(regularCell.session, null);
    assert.equal(regularCell.isBooked, false);
  });

  it('builds nearest in-person exam schedule with metadata and supports discipline filtering', () => {
    const exams = getInPersonExamSchedule('2026-11-23');
    assert.equal(exams.length, 8);
    assert.equal(exams[0].start, '2026-12-14');

    for (const exam of exams) {
      assert.ok(exam.venue && exam.venue.length > 0);
      assert.ok(exam.dayPlan && exam.dayPlan.length >= 2);
      assert.ok(typeof exam.seatsAvailable === 'number' && exam.seatsAvailable > 0);
      assert.ok(exam.registrationDeadlineLabel && exam.registrationDeadlineLabel.length > 0);
    }

    assert.equal(filterExamSchedule(exams, 'all').length, 8);

    const mountainExams = filterExamSchedule(exams, 'горный');
    assert.ok(mountainExams.length >= 2);
    assert.ok(
      mountainExams.every((e) => e.disciplines.some((d) => d.includes('горн')))
    );

    const waterExams = filterExamSchedule(exams, 'водный');
    assert.ok(waterExams.length >= 2);
    assert.ok(
      waterExams.every((e) => e.disciplines.some((d) => d.includes('водн')))
    );
  });

  it('validates sessionDate on CertificationInquiry and persists needs_documents + statusComment', async () => {
    assert.throws(
      () =>
        CertificationInquiry.create({
          fullName: 'Алексей Орлов',
          email: 'orlov@example.ru',
          sessionDate: '2027-02-30',
          consentAccepted: true,
        }),
      ValidationError
    );

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-inq-test-'));
    try {
      const repo = new JsonFileInquiryRepository(tmpDir);
      const bus = new InMemoryDomainEventBus();
      const submit = new SubmitInquiryUseCase(repo, bus);
      const getStats = new GetInquiryStatsUseCase(repo);

      const created = await submit.execute(
        {
          fullName: 'Мария Соколова',
          email: 'sokolova@example.ru',
          contactChannel: '@msokolova',
          region: 'Приморский край',
          track: 'Пешеходный туризм',
          sessionDate: '2027-04-16',
          consentAccepted: true,
        },
        { id: 'user-42' }
      );

      assert.equal(created.sessionDate, '2027-04-16');

      const loaded = await repo.findById(created.id);
      assert.ok(loaded);
      assert.equal(loaded.sessionDate, '2027-04-16');

      const updated = loaded.withStatus(
        'needs_documents',
        'Приложите справку о стаже и скан паспорта маршрута'
      );
      await repo.saveOne(updated);

      const userInquiries = await repo.findByUser('user-42');
      assert.equal(userInquiries.length, 1);
      assert.equal(userInquiries[0].status, 'needs_documents');
      assert.equal(userInquiries[0].sessionDate, '2027-04-16');
      assert.equal(
        userInquiries[0].statusComment,
        'Приложите справку о стаже и скан паспорта маршрута'
      );

      const stats = await getStats.execute();
      assert.equal(stats.byStatus.needs_documents, 1);
      assert.equal(stats.activeCount, 1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
