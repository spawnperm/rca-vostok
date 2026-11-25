import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  INSTRUCTOR_LEVEL_QUESTIONS,
  evaluateInstructorLevel,
} from '../src/utils/instructorLevelQuiz.ts';
import { buildOverviewDemoCertificateData } from '../src/utils/overviewDemoCertificatePdf.ts';
import { buildPersonalLearningPlanModel } from '../src/utils/learningPlanPdf.ts';

test('evaluateInstructorLevel maps starter, intermediate, and advanced answers accurately', () => {
  const starterAnswers = Object.fromEntries(INSTRUCTOR_LEVEL_QUESTIONS.map((q) => [q.id, 'a']));
  const starter = evaluateInstructorLevel(starterAnswers);
  assert.equal(starter.isComplete, true);
  assert.equal(starter.tier, 'starter');
  assert.equal(starter.totalPoints, 5);
  assert.match(starter.recommendedCategory, /1 категория сложности/);

  const midAnswers = Object.fromEntries(INSTRUCTOR_LEVEL_QUESTIONS.map((q) => [q.id, 'b']));
  const mid = evaluateInstructorLevel(midAnswers);
  assert.equal(mid.isComplete, true);
  assert.equal(mid.tier, 'intermediate');
  assert.equal(mid.totalPoints, 10);
  assert.match(mid.recommendedCategory, /1–2 категория сложности/);

  const advAnswers = Object.fromEntries(INSTRUCTOR_LEVEL_QUESTIONS.map((q) => [q.id, 'c']));
  const adv = evaluateInstructorLevel(advAnswers);
  assert.equal(adv.isComplete, true);
  assert.equal(adv.tier, 'advanced');
  assert.equal(adv.totalPoints, 15);
  assert.match(adv.recommendedCategory, /3–4 категория сложности/);
});

test('buildOverviewDemoCertificateData formats certificate fields and clamps readiness percent', () => {
  const fixedNow = new Date('2026-11-23T12:00:00Z');
  const data = buildOverviewDemoCertificateData({
    fullName: '  Иванова Мария Петровна  ',
    region: 'Приморский край',
    track: 'Водный туризм и сплавы',
    category: '1–2 категория сложности',
    contour: 'Контур А (зачёт стажа)',
    readinessPercent: 120,
    now: fixedNow,
  });

  assert.equal(data.fullName, 'Иванова Мария Петровна');
  assert.equal(data.readinessPercent, 100);
  assert.equal(data.issuedAtIso, '2026-11-23');
  assert.match(data.certificateId, /^РЦА-ДМ-2026-1123-\d{4}$/);
  assert.match(data.verdictLabel, /Допущен к очной аттестационной сессии/);

  const fallback = buildOverviewDemoCertificateData({
    fullName: '   ',
    region: '',
    track: '',
    category: '',
    contour: '',
    readinessPercent: 30,
    now: fixedNow,
  });
  assert.equal(fallback.fullName, 'Соискатель РЦА «Русский Восток»');
  assert.equal(fallback.readinessPercent, 50);
  assert.match(fallback.verdictLabel, /Рекомендована целевая подготовка/);
});

test('buildPersonalLearningPlanModel prioritizes gap domains first and computes total hours', () => {
  const fixedNow = new Date('2026-11-23T12:00:00Z');
  const plan = buildPersonalLearningPlanModel({
    candidateName: 'Петров Сергей',
    region: 'Хабаровский край',
    levelId: 'initial',
    gapDomainIds: ['first_aid', 'field_dfo'],
    contour: 'contour_b',
    now: fixedNow,
  });

  assert.equal(plan.candidateName, 'Петров Сергей');
  assert.equal(plan.modules.length, 4);
  assert.equal(plan.modules[0].domainId, 'first_aid');
  assert.equal(plan.modules[0].isGap, true);
  assert.equal(plan.modules[1].domainId, 'field_dfo');
  assert.equal(plan.modules[1].isGap, true);
  assert.equal(plan.modules[2].isGap, false);
  assert.equal(plan.modules[3].isGap, false);
  assert.ok(plan.totalHours > 0);
  assert.ok(plan.recommendedWeeks >= 2);
  assert.match(plan.docCode, /^РЦА-ИПО-2026-\d{4}$/);
});
