import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GLOSSARY_TERMS } from '../src/data/researchData.ts';
import { tokenizeTextWithGlossary } from '../src/utils/glossaryHighlighter.ts';
import {
  COMPETENCY_QUESTIONS,
  buildShortCompetencyQuiz,
  createInitialCompetencyQuizState,
  evaluatePeriodicityStatus,
  gradeCompetencyAttempt,
} from '../src/utils/competencyQuiz.ts';
import {
  buildGoogleCalendarHikeUrl,
  buildHikesScheduleIcs,
  convertExperienceEntryToPlannedHike,
  getDefaultPlannedHikes,
  type PlannedHikeEntry,
} from '../src/utils/hikeScheduleExport.ts';
import { getDefaultJournalEntries } from '../src/domain/experience/ExperienceEntry.ts';

describe('Interactive FSTR Glossary Terms & Highlighter', () => {
  it('contains dedicated FSTR active-tourism terms and highlights them in prose', () => {
    const fstrTerms = GLOSSARY_TERMS.filter((t) => t.category === 'fstr');
    assert.ok(fstrTerms.length >= 8);
    assert.ok(fstrTerms.some((t) => t.id === 'term-fstr'));
    assert.ok(fstrTerms.some((t) => t.id === 'term-route-book'));
    assert.ok(fstrTerms.some((t) => t.id === 'term-control-deadline'));

    const sample =
      'Перед выходом на маршрут группы по классификации ФСТР оформляется маршрутная книжка и фиксируется КСР.';
    const segments = tokenizeTextWithGlossary(sample);
    const matchedIds = segments
      .filter((s): s is Extract<typeof s, { type: 'term' }> => s.type === 'term')
      .map((s) => s.term.id);

    assert.ok(matchedIds.includes('term-fstr'));
    assert.ok(matchedIds.includes('term-route-book'));
    assert.ok(matchedIds.includes('term-control-deadline'));
  });
});

describe('Competency Assessment Quiz (NPA & Safety)', () => {
  it('builds balanced 6-question short quizzes (3 NPA + 3 Safety) and rotates wrong/unseen items', () => {
    const firstQuiz = buildShortCompetencyQuiz(null);
    assert.equal(firstQuiz.length, 6);
    assert.equal(firstQuiz.filter((q) => q.domain === 'npa').length, 3);
    assert.equal(firstQuiz.filter((q) => q.domain === 'safety').length, 3);

    // Simulate completing first quiz with 1 wrong NPA answer and 1 wrong safety answer
    const answers: Record<string, string> = {};
    firstQuiz.forEach((q, idx) => {
      if (idx === 0 || idx === 3) {
        const wrongOpt = q.options.find((o) => o.id !== q.correctId)!;
        answers[q.id] = wrongOpt.id;
      } else {
        answers[q.id] = q.correctId;
      }
    });

    const attempt = gradeCompetencyAttempt(firstQuiz, answers, 30, '2027-03-01T10:00:00.000Z');
    assert.equal(attempt.correctCount, 4);
    assert.equal(attempt.scorePercent, 67);
    assert.equal(attempt.npaPercent, 67);
    assert.equal(attempt.safetyPercent, 67);
    assert.deepEqual(attempt.wrongQuestionIds, [firstQuiz[0].id, firstQuiz[3].id]);

    const secondQuiz = buildShortCompetencyQuiz(attempt);
    const secondIds = new Set(secondQuiz.map((q) => q.id));
    // Must retain the two wrong questions so the guide remediates mistakes
    assert.ok(secondIds.has(firstQuiz[0].id));
    assert.ok(secondIds.has(firstQuiz[3].id));
    // And pull unseen questions from the 12-question pool instead of repeating already-correct ones
    assert.ok(COMPETENCY_QUESTIONS.length >= 12);
    assert.ok(!secondIds.has(firstQuiz[1].id));
  });

  it('evaluates periodic reminder urgency across due_first, up_to_date, due_soon, and overdue states', () => {
    const initial = createInitialCompetencyQuizState();
    const firstEval = evaluatePeriodicityStatus(initial, new Date('2027-03-01T00:00:00Z'));
    assert.equal(firstEval.urgency, 'due_first');

    const dummyAttempt = gradeCompetencyAttempt(
      buildShortCompetencyQuiz(null),
      {},
      30,
      '2027-03-01T00:00:00Z'
    );
    const completedState = {
      ...initial,
      intervalDays: 30 as const,
      lastCompletedAt: '2027-03-01T00:00:00Z',
      attempts: [dummyAttempt],
    };

    const freshEval = evaluatePeriodicityStatus(completedState, new Date('2027-03-10T00:00:00Z'));
    assert.equal(freshEval.urgency, 'up_to_date');
    assert.ok((freshEval.daysRemaining ?? 0) > 5);

    const soonEval = evaluatePeriodicityStatus(completedState, new Date('2027-03-28T00:00:00Z'));
    assert.equal(soonEval.urgency, 'due_soon');

    const overdueEval = evaluatePeriodicityStatus(completedState, new Date('2027-04-05T00:00:00Z'));
    assert.equal(overdueEval.urgency, 'overdue');
  });
});

describe('Planned Hike Schedule .ics Export', () => {
  it('generates RFC 5545 multi-event VCALENDAR compatible with Google, Yandex, and Apple', () => {
    const hikes: PlannedHikeEntry[] = [
      {
        id: 'test-hike-1',
        title: 'г. Пидан, траверс; группа',
        region: 'Приморский край',
        discipline: 'hiking',
        complexity: '2 КС',
        startDateIso: '2027-05-10',
        endDateIso: '2027-05-11',
        startTimeLocal: '08:00',
        participantsCount: 12,
        meetingPoint: 'с. Лукьяновка, парковка',
        reminderDaysBefore: 10,
        notes: 'Проверка раций и МЧС\nВзять тент',
      },
      ...getDefaultPlannedHikes('Камчатский край').slice(0, 1),
    ];

    const ics = buildHikesScheduleIcs(hikes, {
      overrideReminderDays: 10,
      now: new Date('2027-04-01T00:00:00Z'),
    });

    assert.ok(ics.includes('BEGIN:VCALENDAR\r\n'));
    assert.ok(ics.includes('VERSION:2.0\r\n'));
    assert.ok(ics.includes('METHOD:PUBLISH\r\n'));
    assert.equal((ics.match(/BEGIN:VEVENT\r\n/g) ?? []).length, 2);
    assert.equal((ics.match(/END:VEVENT\r\n/g) ?? []).length, 2);
    assert.ok(ics.includes('TRIGGER:-P10D\r\n'));
    // Escaped commas, semicolons, and newlines
    assert.ok(ics.includes('SUMMARY:[2 КС] г. Пидан\\, траверс\\; группа\r\n'));
    assert.ok(ics.includes('Проверка раций и МЧС\\nВзять тент'));
    // UTC+10 08:00 local -> 22:00 UTC previous day (2027-05-09T22:00:00Z)
    assert.ok(ics.includes('DTSTART:20270509T220000Z\r\n'));
    assert.ok(ics.endsWith('END:VCALENDAR'));

    assert.throws(() => buildHikesScheduleIcs([]), /Выберите хотя бы один/);
  });

  it('builds Google Calendar URL and converts logged journal entries into planned hikes', () => {
    const defaults = getDefaultJournalEntries('Приморский край');
    const converted = convertExperienceEntryToPlannedHike(
      defaults[0],
      '2027-08-15',
      new Date('2027-04-01T00:00:00Z')
    );
    assert.equal(converted.startDateIso, '2027-08-15');
    assert.equal(converted.complexity, defaults[0].complexity);

    const googleUrl = buildGoogleCalendarHikeUrl(converted);
    assert.ok(googleUrl.startsWith('https://calendar.google.com/calendar/render?'));
    assert.ok(googleUrl.includes('action=TEMPLATE'));
  });
});
