import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ATTESTATION_CALENDAR_EVENTS,
  DFO_REGION_FILTER_OPTIONS,
  filterAttestationCalendarEvents,
  matchesDirectDfoRegion,
} from '../src/utils/attestationCalendar.ts';
import {
  JsonFileReadinessSurveyRepository,
  validateReadinessSurveyInput,
} from '../src/infrastructure/persistence/JsonFileReadinessSurveyRepository.ts';
import { matchFaqScenarioReply, retrieveSectionRagContext } from '../src/utils/rcaRagEngine.ts';
import { ATTESTATION_FAQ, GLOSSARY_TERMS } from '../src/data/researchData.ts';
import { tokenizeTextWithGlossary } from '../src/utils/glossaryHighlighter.ts';

test('DFO calendar region filters narrow attestation sessions while keeping interregional options', () => {
  const allEvents = filterAttestationCalendarEvents(ATTESTATION_CALENDAR_EVENTS, 'all', 'all');
  assert.equal(allEvents.length, ATTESTATION_CALENDAR_EVENTS.length);

  for (const reg of DFO_REGION_FILTER_OPTIONS) {
    if (reg.id === 'all') continue;
    const regionEvents = filterAttestationCalendarEvents(ATTESTATION_CALENDAR_EVENTS, 'all', reg.id);
    assert.ok(regionEvents.length > 0, `Expected events for DFO region ${reg.id}`);
    assert.ok(
      regionEvents.length < allEvents.length,
      `Expected region filter ${reg.id} to narrow full event list`
    );

    const hasDirectRegionSession = regionEvents.some((ev) => matchesDirectDfoRegion(ev, reg.id));
    assert.equal(hasDirectRegionSession, true, `Missing direct match for ${reg.id}`);
  }

  const kamchatkaSessions = filterAttestationCalendarEvents(
    ATTESTATION_CALENDAR_EVENTS,
    'session',
    'kamchatka'
  );
  assert.ok(kamchatkaSessions.some((ev) => ev.id === 'cal-session-mar-kamchatka'));
  assert.equal(
    kamchatkaSessions.some((ev) => ev.id === 'cal-session-feb-khabarovsk'),
    false
  );
});

test('JsonFileReadinessSurveyRepository validates input, computes readinessPct, and aggregates stats', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rca-survey-test-'));
  try {
    const repo = new JsonFileReadinessSurveyRepository(tempDir);
    assert.equal(repo.getStats().totalResponses, 0);

    const first = repo.submit({
      region: 'Приморский край',
      track: 'Пешеходный туризм',
      experienceRange: '3–5 лет',
      preferredFormat: 'Контур А (зачёт стажа практиков)',
      plannedTimeframe: 'Ближайшая сессия (зима 2026 / весна 2027)',
      mainBarrier: 'Оформление паспорта маршрута (ПП № 760)',
      readyDocs: ['medical', 'experience_proof', 'wfa_gear'],
      respondentName: 'Турклуб Тест',
      comment: 'Готов на весну',
    });

    assert.equal(first.record.readinessPct, 60);
    assert.equal(first.stats.totalResponses, 1);
    assert.equal(first.stats.averageReadinessPct, 60);
    assert.equal(first.stats.byRegion[0]?.region, 'Приморский край');

    const second = repo.submit({
      region: 'Камчатский край',
      track: 'Водный туризм и сплавы',
      experienceRange: 'Более 5 лет',
      preferredFormat: 'Переподготовка ДПО ВВГУ + экзамен',
      plannedTimeframe: 'Лето–осень 2027',
      mainBarrier: 'Барьеров нет — готов к экзамену',
      readyDocs: ['medical', 'experience_proof', 'route_passport', 'education_dpo', 'wfa_gear'],
      respondentName: '',
      comment: '',
    });

    assert.equal(second.record.readinessPct, 100);
    assert.equal(second.stats.totalResponses, 2);
    assert.equal(second.stats.averageReadinessPct, 80);

    assert.throws(() =>
      validateReadinessSurveyInput({
        region: 'Неизвестный регион',
        track: 'Пешеходный туризм',
        experienceRange: '3–5 лет',
        preferredFormat: 'Контур А (зачёт стажа практиков)',
        plannedTimeframe: 'Ближайшая сессия (зима 2026 / весна 2027)',
        mainBarrier: 'Оформление паспорта маршрута (ПП № 760)',
        readyDocs: [],
      })
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('FAQ and RAG helpers ground Overview chatbot answers in platform data', () => {
  assert.ok(ATTESTATION_FAQ.length >= 6);
  const reply = matchFaqScenarioReply('Какие документы нужны для аттестации?', 'overview');
  assert.ok(reply.answer && reply.answer.length > 40);

  const rag = retrieveSectionRagContext('ПП РФ 760 паспорт маршрута', 'overview', 3);
  assert.ok(rag.chunks.length >= 1);
});

test('tokenizeTextWithGlossary highlights активный туризм, инструктор-проводник, полевые испытания and походный стаж in inflected Overview prose', () => {
  const sample =
    'Баланс кадров активного туризма ДФО требует, чтобы инструкторов-проводников допускали через походный стаж и полевые испытания в РЦА.';
  const segments = tokenizeTextWithGlossary(sample, GLOSSARY_TERMS);
  const matchedIds = segments.filter((s) => s.type === 'term').map((s) => s.term.id);

  assert.ok(matchedIds.includes('term-active-tourism'));
  assert.ok(matchedIds.includes('term-instructor-guide'));
  assert.ok(matchedIds.includes('term-hiking-experience'));
  assert.ok(matchedIds.includes('term-field-trials'));
  assert.ok(matchedIds.includes('term-rca'));
  assert.equal(segments.map((s) => s.text).join(''), sample);
});
