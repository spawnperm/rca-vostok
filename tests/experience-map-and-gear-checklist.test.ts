import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ExperienceEntry,
  getDefaultJournalEntries,
  type ExperienceLogEntry,
} from '../src/domain/experience/ExperienceEntry.ts';
import { parseGpxTrack } from '../src/domain/experience/GpxTrackParser.ts';
import {
  resolveAllExpeditionEndpoints,
  resolveExpeditionEndpoints,
} from '../src/utils/experienceMapPoints.ts';
import {
  formatGearChecklistText,
  generateGearChecklist,
  summarizeJournalForGear,
} from '../src/utils/gearChecklistGenerator.ts';

test('ExperienceEntry validates optional startPoint/finishPoint coordinates and preserves them in snapshots', () => {
  const created = ExperienceEntry.create(
    {
      date: '2026-09-20',
      routeTitle: 'Восхождение на г. Облачная',
      regionId: 'primorye',
      complexity: '2 КС',
      participantsCount: 8,
      distanceKm: 28,
      startPoint: { lat: 43.635, lon: 134.142, label: 'с. Ясное' },
      finishPoint: { lat: 43.694, lon: 134.198, label: 'Вершина 1854 м' },
    },
    new Date('2026-10-01T00:00:00Z')
  );

  const snap = created.toSnapshot();
  assert.deepEqual(snap.startPoint, { lat: 43.635, lon: 134.142, label: 'с. Ясное' });
  assert.deepEqual(snap.finishPoint, { lat: 43.694, lon: 134.198, label: 'Вершина 1854 м' });

  assert.throws(() => {
    ExperienceEntry.create({
      date: '2026-09-20',
      routeTitle: 'Некорректные координаты',
      regionId: 'primorye',
      complexity: '1 КС',
      participantsCount: 6,
      startPoint: { lat: 120, lon: 132.5 },
    });
  }, /корректные координаты/i);

  assert.throws(() => {
    ExperienceEntry.create({
      date: '2026-09-20',
      routeTitle: 'Некорректная долгота',
      regionId: 'primorye',
      complexity: '1 КС',
      participantsCount: 6,
      finishPoint: { lat: 43.1, lon: 210 },
    });
  }, /корректные координаты/i);
});

test('parseGpxTrack extracts startPoint and finishPoint from track endpoints', () => {
  const sampleGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>Хребет Чандалаз — траверс</name>
    <trkseg>
      <trkpt lat="43.0120" lon="133.0120"><time>2026-08-15T06:00:00Z</time></trkpt>
      <trkpt lat="43.0250" lon="133.0200"><time>2026-08-15T09:00:00Z</time></trkpt>
      <trkpt lat="43.0390" lon="133.0280"><time>2026-08-15T12:00:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;

  const parsed = parseGpxTrack(sampleGpx);
  assert.equal(parsed.routeTitle, 'Хребет Чандалаз — траверс');
  assert.deepEqual(parsed.startPoint, {
    lat: 43.012,
    lon: 133.012,
  });
  assert.deepEqual(parsed.finishPoint, {
    lat: 43.039,
    lon: 133.028,
  });
});

test('resolveExpeditionEndpoints resolves explicit, landmark, and regional fallback Start/Finish points', () => {
  const defaults = getDefaultJournalEntries('Приморский край');
  const resolvedDefaults = resolveAllExpeditionEndpoints(defaults);
  assert.equal(resolvedDefaults.length, defaults.length);
  for (const item of resolvedDefaults) {
    assert.ok(Number.isFinite(item.start.lat) && Number.isFinite(item.start.lon));
    assert.ok(Number.isFinite(item.finish.lat) && Number.isFinite(item.finish.lon));
    assert.equal(item.coordinateSource, 'explicit');
  }

  const landmarkOnly: ExperienceLogEntry = {
    id: 'lm-1',
    date: '2026-07-01',
    routeTitle: 'Сплав по реке Быстрая (Малки — Японский мост)',
    regionId: 'kamchatka',
    regionName: 'Камчатский край',
    complexity: '2 КС',
    participantsCount: 9,
    notes: '',
    createdAt: '2026-07-01T00:00:00Z',
  };
  const resolvedLandmark = resolveExpeditionEndpoints(landmarkOnly);
  assert.equal(resolvedLandmark.coordinateSource, 'landmark');
  assert.match(resolvedLandmark.start.label, /Малки/);
  assert.match(resolvedLandmark.finish.label, /Японский мост/);

  const customManual: ExperienceLogEntry = {
    id: 'reg-1',
    date: '2026-08-01',
    routeTitle: 'Неизвестный таёжный ключ № 4',
    regionId: 'yakutia',
    regionName: 'Республика Саха (Якутия)',
    complexity: '3 КС',
    participantsCount: 6,
    distanceKm: 45,
    notes: '',
    createdAt: '2026-08-01T00:00:00Z',
  };
  const resolvedModel = resolveExpeditionEndpoints(customManual);
  assert.equal(resolvedModel.coordinateSource, 'region_model');
  assert.ok(resolvedModel.start.lat > 58 && resolvedModel.finish.lat > 58);
});

test('summarizeJournalForGear and generateGearChecklist tailor equipment and medications to journal regions and complexity', () => {
  const kamchatkaWaterJournal: ExperienceLogEntry[] = [
    {
      id: 'kw-1',
      date: '2026-08-12',
      routeTitle: 'Сплав на рафтах по реке Быстрая',
      regionId: 'kamchatka',
      regionName: 'Камчатский край',
      complexity: '3 КС',
      participantsCount: 10,
      distanceKm: 65,
      notes: 'Холодные броды',
      createdAt: '2026-08-12T00:00:00Z',
    },
  ];

  const summary = summarizeJournalForGear(kamchatkaWaterJournal, 'Приморский край');
  assert.equal(summary.primaryRegionId, 'kamchatka');
  assert.equal(summary.maxComplexity, '3 КС');
  assert.equal(summary.inferredProfile, 'water');
  assert.equal(summary.avgGroupSize, 10);

  const checklist = generateGearChecklist({
    regionId: summary.primaryRegionId,
    complexity: summary.recommendedNextComplexity,
    profile: summary.inferredProfile,
    season: 'cold',
    groupSize: summary.avgGroupSize,
  });

  assert.ok(checklist.equipmentCount > 5);
  assert.ok(checklist.medicationCount >= 5);
  assert.ok(checklist.mandatoryCount > 0);
  assert.match(checklist.regionClimateNote, /Камчатский край/i);

  const itemNames = checklist.allItems.map((i) => i.name).join(' | ');
  // Water profile + 3+ КС + cold season + Kamchatka specifics
  assert.match(itemNames, /Спасательный жилет|спасжилет/i);
  assert.match(itemNames, /Морковка|спас-конец/i);
  assert.match(itemNames, /фальшфейер|медвеж/i);
  assert.match(itemNames, /Турникет|кровоостанавливающ/i);

  const txt = formatGearChecklistText(checklist, new Set([checklist.allItems[0].id]));
  assert.match(txt, /\[x\]/);
  assert.match(txt, /\[ \]/);
  assert.match(txt, /Аптечка и медикаменты/i);
});
