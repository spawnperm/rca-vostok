import {
  DFO_REGIONAL_DEMAND_FORECAST_2025_2030,
  DFO_REGIONS_DISTRIBUTION,
  type DfoRegionDistribution,
} from '../data/researchData.ts';

export interface DfoReportAnalyticsSnapshot {
  sessions: number;
  uniqueVisitors: number;
  pageviews: number;
  avgScrollDepth: number;
}

export interface DfoReportExportOptions {
  regionFilterId: string;
  compareRegionAId: string;
  compareRegionBId: string;
  analyticsTotals?: DfoReportAnalyticsSnapshot | null;
}

const OTHER_CLUSTER_WEIGHTS: Record<string, number> = {
  sakhalin: 320 / 680,
  yakutia: 180 / 680,
  amur: 110 / 680,
  'magadan-chukotka': 70 / 680,
};

export function getRegionDemand2030(regionId: string): number {
  const lastPoint =
    DFO_REGIONAL_DEMAND_FORECAST_2025_2030.base[
      DFO_REGIONAL_DEMAND_FORECAST_2025_2030.base.length - 1
    ];
  if (!lastPoint) return 0;
  if (regionId === 'primorye') return lastPoint.primorye;
  if (regionId === 'kamchatka') return lastPoint.kamchatka;
  if (regionId === 'khabarovsk') return lastPoint.khabarovsk;
  if (regionId in OTHER_CLUSTER_WEIGHTS) {
    return Math.round(lastPoint.sakhalinAndOther * OTHER_CLUSTER_WEIGHTS[regionId]);
  }
  return lastPoint.totalDemand;
}

function getRegionRowMetrics(region: DfoRegionDistribution, totalRegistry: number) {
  const deficit = Math.max(0, region.estimatedDemand - region.certifiedInRegistry);
  const coveragePct =
    region.estimatedDemand > 0
      ? Math.round((region.certifiedInRegistry / region.estimatedDemand) * 1000) / 10
      : 0;
  const registrySharePct =
    totalRegistry > 0
      ? Math.round((region.certifiedInRegistry / totalRegistry) * 1000) / 10
      : 0;
  const demand2030 = getRegionDemand2030(region.id);
  return { deficit, coveragePct, registrySharePct, demand2030 };
}

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[;"\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildDfoAnalyticsCsvContent(options: DfoReportExportOptions): string {
  const totalRegistry = DFO_REGIONS_DISTRIBUTION.reduce(
    (sum, r) => sum + r.certifiedInRegistry,
    0
  );
  const totalDemand = DFO_REGIONS_DISTRIBUTION.reduce(
    (sum, r) => sum + r.estimatedDemand,
    0
  );
  const totalDeficit = DFO_REGIONS_DISTRIBUTION.reduce(
    (sum, r) => sum + Math.max(0, r.estimatedDemand - r.certifiedInRegistry),
    0
  );
  const totalOct = DFO_REGIONS_DISTRIBUTION.reduce(
    (sum, r) => sum + r.october2026Certified,
    0
  );
  const total2030 = DFO_REGIONS_DISTRIBUTION.reduce(
    (sum, r) => sum + getRegionDemand2030(r.id),
    0
  );

  const selectedRegions =
    options.regionFilterId === 'all'
      ? DFO_REGIONS_DISTRIBUTION
      : DFO_REGIONS_DISTRIBUTION.filter((r) => r.id === options.regionFilterId);

  const regionA =
    DFO_REGIONS_DISTRIBUTION.find((r) => r.id === options.compareRegionAId) ??
    DFO_REGIONS_DISTRIBUTION[0];
  const regionB =
    DFO_REGIONS_DISTRIBUTION.find((r) => r.id === options.compareRegionBId) ??
    DFO_REGIONS_DISTRIBUTION[1];

  const metricsA = getRegionRowMetrics(regionA, totalRegistry);
  const metricsB = getRegionRowMetrics(regionB, totalRegistry);

  const lines: string[] = [];
  const pushRow = (cols: (string | number)[]) => {
    lines.push(cols.map(csvEscape).join(';'));
  };

  pushRow(['Аналитический отчет РЦА «Русский Восток» (ВВГУ) по регионам ДФО']);
  pushRow(['Дата формирования', new Date().toLocaleString('ru-RU')]);
  pushRow([
    'Активный фильтр ДФО',
    options.regionFilterId === 'all'
      ? 'Все регионы ДФО (7 субъектов)'
      : DFO_REGIONS_DISTRIBUTION.find((r) => r.id === options.regionFilterId)?.name ??
        options.regionFilterId,
  ]);
  if (options.analyticsTotals) {
    pushRow([
      'Веб-аналитика портала (сессии / посетители / просмотры / прокрутка)',
      `${options.analyticsTotals.sessions} / ${options.analyticsTotals.uniqueVisitors} / ${options.analyticsTotals.pageviews} / ${options.analyticsTotals.avgScrollDepth}%`,
    ]);
  }
  lines.push('');

  pushRow([
    'Субъект ДФО',
    'Аттестовано в реестре (чел.)',
    'Расчётный спрос 2025 (чел.)',
    'Кадровый дефицит (чел.)',
    'Покрытие спроса (%)',
    'Доля реестра ДФО (%)',
    'Выпуск РЦА окт. 2026 (чел.)',
    'Прогноз спроса 2030 (чел.)',
    'Статус',
    'Ключевые направления',
  ]);

  for (const reg of selectedRegions) {
    const m = getRegionRowMetrics(reg, totalRegistry);
    pushRow([
      reg.name,
      reg.certifiedInRegistry,
      reg.estimatedDemand,
      m.deficit,
      `${m.coveragePct}%`,
      `${m.registrySharePct}%`,
      reg.october2026Certified,
      m.demand2030,
      reg.statusLabel,
      reg.keyTracks,
    ]);
  }

  if (options.regionFilterId === 'all') {
    const overallCoverage =
      totalDemand > 0 ? Math.round((totalRegistry / totalDemand) * 1000) / 10 : 0;
    pushRow([
      'ИТОГО ПО ДФО',
      totalRegistry,
      totalDemand,
      totalDeficit,
      `${overallCoverage}%`,
      '100%',
      totalOct,
      total2030,
      'Совокупный контур ДФО',
      'Все направления активного туризма',
    ]);
  }

  lines.push('');
  pushRow(['Сопоставление двух выбранных регионов ДФО', regionA.name, regionB.name, 'Разница (А - Б)']);
  pushRow([
    'Аттестовано в реестре (чел.)',
    regionA.certifiedInRegistry,
    regionB.certifiedInRegistry,
    regionA.certifiedInRegistry - regionB.certifiedInRegistry,
  ]);
  pushRow([
    'Расчётный спрос (чел.)',
    regionA.estimatedDemand,
    regionB.estimatedDemand,
    regionA.estimatedDemand - regionB.estimatedDemand,
  ]);
  pushRow([
    'Кадровый дефицит (чел.)',
    metricsA.deficit,
    metricsB.deficit,
    metricsA.deficit - metricsB.deficit,
  ]);
  pushRow([
    'Покрытие спроса (%)',
    `${metricsA.coveragePct}%`,
    `${metricsB.coveragePct}%`,
    `${Math.round((metricsA.coveragePct - metricsB.coveragePct) * 10) / 10} п.п.`,
  ]);
  pushRow([
    'Прогноз спроса 2030 (чел.)',
    metricsA.demand2030,
    metricsB.demand2030,
    metricsA.demand2030 - metricsB.demand2030,
  ]);

  return '\uFEFF' + lines.join('\r\n');
}

export function exportDfoAnalyticsCsv(options: DfoReportExportOptions): void {
  const csv = buildDfoAnalyticsCsvContent(options);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const suffix = options.regionFilterId === 'all' ? 'dfo' : options.regionFilterId;
  triggerBlobDownload(
    blob,
    `rca-vostok-report-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`
  );
}

/**
 * Wraps a JPEG byte array inside a standards-compliant PDF 1.4 A4 document.
 * Pure TypeScript, zero external dependencies, full UTF-8/Cyrillic support via canvas rendering.
 */
export function wrapJpegBytesAsPdf(
  jpegBytes: Uint8Array,
  pixelWidth: number,
  pixelHeight: number
): Uint8Array {
  const enc = new TextEncoder();
  const pageWidthPt = 595.28;
  const pageHeightPt = 841.89;

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // obj 0 is free entry
  let cursor = 0;

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    cursor += bytes.length;
  };
  const pushStr = (text: string) => pushBytes(enc.encode(text));

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // 1: Catalog
  offsets.push(cursor);
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 2: Pages
  offsets.push(cursor);
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // 3: Page
  offsets.push(cursor);
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt.toFixed(2)} ${pageHeightPt.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  // 4: Image XObject (DCTDecode JPEG)
  offsets.push(cursor);
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  pushBytes(jpegBytes);
  pushStr('\nendstream\nendobj\n');

  // 5: Page Content Stream
  const contentStream = `q\n${pageWidthPt.toFixed(2)} 0 0 ${pageHeightPt.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = enc.encode(contentStream);
  offsets.push(cursor);
  pushStr(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
  pushBytes(contentBytes);
  pushStr('endstream\nendobj\n');

  // xref
  const xrefStart = cursor;
  pushStr(`xref\n0 ${offsets.length}\n`);
  pushStr('0000000000 65535 f \n');
  for (let i = 1; i < offsets.length; i += 1) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }

  pushStr(
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  );

  const totalLen = chunks.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function exportDfoAnalyticsPdf(
  options: DfoReportExportOptions
): Promise<void> {
  if (typeof document === 'undefined') return;
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  // A4 2x DPI canvas (1240 x 1754)
  const W = 1240;
  const H = 1754;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось инициализировать графический контекст для PDF.');
  }

  const fontSans = '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const fontMono = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Header Band
  const padX = 64;
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, W, 210);

  ctx.fillStyle = '#5EEAD4';
  ctx.font = `600 18px ${fontSans}`;
  ctx.fillText('РЦА «РУССКИЙ ВОСТОК» · ВВГУ · ФСТР', padX, 58);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 32px ${fontSans}`;
  ctx.fillText('Аналитический отчёт по аттестации проводников в ДФО', padX, 108);

  const activeFilterObj =
    options.regionFilterId === 'all'
      ? null
      : DFO_REGIONS_DISTRIBUTION.find((r) => r.id === options.regionFilterId) ?? null;

  ctx.fillStyle = '#CBD5E1';
  ctx.font = `400 17px ${fontSans}`;
  ctx.fillText(
    `Дата выгрузки: ${new Date().toLocaleString('ru-RU')}   ·   Срез: ${
      activeFilterObj ? activeFilterObj.name : 'Все субъекты ДФО (7 регионов)'
    }`,
    padX,
    152
  );

  if (options.analyticsTotals) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = `500 15px ${fontMono}`;
    ctx.fillText(
      `Статистика портала: ${options.analyticsTotals.sessions} сессий · ${options.analyticsTotals.uniqueVisitors} посетителей · ${options.analyticsTotals.pageviews} просмотров разделов`,
      padX,
      184
    );
  }

  // Compute totals
  const totalRegistry = DFO_REGIONS_DISTRIBUTION.reduce(
    (sum, r) => sum + r.certifiedInRegistry,
    0
  );
  const totalDemand = DFO_REGIONS_DISTRIBUTION.reduce(
    (sum, r) => sum + r.estimatedDemand,
    0
  );
  const totalDeficit = DFO_REGIONS_DISTRIBUTION.reduce(
    (sum, r) => sum + Math.max(0, r.estimatedDemand - r.certifiedInRegistry),
    0
  );
  const total2030 = DFO_REGIONS_DISTRIBUTION.reduce(
    (sum, r) => sum + getRegionDemand2030(r.id),
    0
  );
  const totalCoverage =
    totalDemand > 0 ? Math.round((totalRegistry / totalDemand) * 1000) / 10 : 0;

  // KPI Cards Row
  const kpiY = 246;
  const kpiGap = 20;
  const kpiW = (W - padX * 2 - kpiGap * 3) / 4;
  const kpiH = 120;
  const kpis = [
    {
      label: 'В реестре по ДФО',
      value: `${totalRegistry.toLocaleString('ru-RU')} чел.`,
      sub: 'Единый федеральный реестр',
      color: '#0F766E',
    },
    {
      label: 'Расчётный спрос 2025',
      value: `${totalDemand.toLocaleString('ru-RU')} чел.`,
      sub: 'Потребность активного сегмента',
      color: '#0F172A',
    },
    {
      label: 'Совокупный дефицит',
      value: `${totalDeficit.toLocaleString('ru-RU')} чел.`,
      sub: `Среднее покрытие: ${totalCoverage}%`,
      color: '#B91C1C',
    },
    {
      label: 'Прогноз спроса 2030',
      value: `${total2030.toLocaleString('ru-RU')} чел.`,
      sub: 'Базовый сценарий роста ВВГУ',
      color: '#B45309',
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = padX + idx * (kpiW + kpiGap);
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, x, kpiY, kpiW, kpiH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = `600 14px ${fontSans}`;
    ctx.fillText(kpi.label, x + 20, kpiY + 34);

    ctx.fillStyle = kpi.color;
    ctx.font = `700 28px ${fontMono}`;
    ctx.fillText(kpi.value, x + 20, kpiY + 76);

    ctx.fillStyle = '#64748B';
    ctx.font = `400 13px ${fontSans}`;
    ctx.fillText(kpi.sub, x + 20, kpiY + 102);
  });

  // Table 1: All DFO Regions
  let y = 415;
  ctx.fillStyle = '#0F766E';
  ctx.font = `600 15px ${fontSans}`;
  ctx.fillText('1. СВОДНАЯ ТАБЛИЦА ПО СУБЪЕКТАМ ДАЛЬНЕГО ВОСТОКА', padX, y);
  y += 28;
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 22px ${fontSans}`;
  ctx.fillText('Показатели реестра, спроса и кадрового дефицита по регионам ДФО', padX, y);
  y += 24;

  const tableW = W - padX * 2;
  const cols = [
    { label: 'Субъект ДФО', x: padX + 16, align: 'left' as const },
    { label: 'В реестре', x: padX + 410, align: 'right' as const },
    { label: 'Спрос 2025', x: padX + 555, align: 'right' as const },
    { label: 'Дефицит', x: padX + 700, align: 'right' as const },
    { label: 'Покрытие', x: padX + 835, align: 'right' as const },
    { label: 'Окт. 2026', x: padX + 955, align: 'right' as const },
    { label: 'Прогноз 2030', x: padX + tableW - 16, align: 'right' as const },
  ];

  // Table header
  ctx.fillStyle = '#F1F5F9';
  drawRoundedRect(ctx, padX, y, tableW, 46, 8);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = `700 14px ${fontSans}`;
  cols.forEach((col) => {
    ctx.textAlign = col.align;
    ctx.fillText(col.label, col.x, y + 29);
  });
  ctx.textAlign = 'left';
  y += 46;

  DFO_REGIONS_DISTRIBUTION.forEach((reg, idx) => {
    const isHighlighted = options.regionFilterId === reg.id;
    const m = getRegionRowMetrics(reg, totalRegistry);
    const rowH = 54;

    if (isHighlighted) {
      ctx.fillStyle = '#F0FDFA';
      ctx.fillRect(padX, y, tableW, rowH);
    } else if (idx % 2 === 1) {
      ctx.fillStyle = '#FAFCFE';
      ctx.fillRect(padX, y, tableW, rowH);
    }

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y + rowH);
    ctx.lineTo(padX + tableW, y + rowH);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = isHighlighted ? '#0F766E' : '#0F172A';
    ctx.font = `${isHighlighted ? '700' : '600'} 16px ${fontSans}`;
    ctx.fillText(reg.name, cols[0].x, y + 33);

    ctx.textAlign = 'right';
    ctx.font = `700 16px ${fontMono}`;
    ctx.fillStyle = '#0F766E';
    ctx.fillText(reg.certifiedInRegistry.toLocaleString('ru-RU'), cols[1].x, y + 33);

    ctx.fillStyle = '#0F172A';
    ctx.font = `500 16px ${fontMono}`;
    ctx.fillText(reg.estimatedDemand.toLocaleString('ru-RU'), cols[2].x, y + 33);

    ctx.fillStyle = '#B91C1C';
    ctx.fillText(m.deficit.toLocaleString('ru-RU'), cols[3].x, y + 33);

    ctx.fillStyle = '#334155';
    ctx.fillText(`${m.coveragePct}%`, cols[4].x, y + 33);

    ctx.fillStyle = reg.october2026Certified > 0 ? '#0F766E' : '#94A3B8';
    ctx.fillText(
      reg.october2026Certified > 0 ? `+${reg.october2026Certified}` : '0',
      cols[5].x,
      y + 33
    );

    ctx.fillStyle = '#0F172A';
    ctx.fillText(m.demand2030.toLocaleString('ru-RU'), cols[6].x, y + 33);
    ctx.textAlign = 'left';

    y += rowH;
  });

  // Totals row
  const octTotal = DFO_REGIONS_DISTRIBUTION.reduce(
    (sum, r) => sum + r.october2026Certified,
    0
  );
  ctx.fillStyle = '#0F172A';
  drawRoundedRect(ctx, padX, y + 4, tableW, 50, 8);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 16px ${fontSans}`;
  ctx.fillText('Итого по ДФО (7 регионов)', cols[0].x, y + 35);

  ctx.textAlign = 'right';
  ctx.font = `700 16px ${fontMono}`;
  ctx.fillStyle = '#5EEAD4';
  ctx.fillText(totalRegistry.toLocaleString('ru-RU'), cols[1].x, y + 35);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(totalDemand.toLocaleString('ru-RU'), cols[2].x, y + 35);
  ctx.fillStyle = '#FCA5A5';
  ctx.fillText(totalDeficit.toLocaleString('ru-RU'), cols[3].x, y + 35);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`${totalCoverage}%`, cols[4].x, y + 35);
  ctx.fillStyle = '#5EEAD4';
  ctx.fillText(`+${octTotal}`, cols[5].x, y + 35);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(total2030.toLocaleString('ru-RU'), cols[6].x, y + 35);
  ctx.textAlign = 'left';

  // Section 2: Pair Comparison Table (A vs B)
  y += 108;
  const regA =
    DFO_REGIONS_DISTRIBUTION.find((r) => r.id === options.compareRegionAId) ??
    DFO_REGIONS_DISTRIBUTION[0];
  const regB =
    DFO_REGIONS_DISTRIBUTION.find((r) => r.id === options.compareRegionBId) ??
    DFO_REGIONS_DISTRIBUTION[1];
  const mA = getRegionRowMetrics(regA, totalRegistry);
  const mB = getRegionRowMetrics(regB, totalRegistry);

  ctx.fillStyle = '#0F766E';
  ctx.font = `600 15px ${fontSans}`;
  ctx.fillText('2. ПАРНОЕ СОПОСТАВЛЕНИЕ ВЫБРАННЫХ РЕГИОНОВ ДФО', padX, y);
  y += 28;
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 22px ${fontSans}`;
  ctx.fillText(`${regA.name}  vs  ${regB.name}`, padX, y);
  y += 24;

  const cmpCols = [
    { label: 'Показатель аттестации', x: padX + 16, align: 'left' as const },
    { label: regA.shortName, x: padX + 580, align: 'right' as const },
    { label: regB.shortName, x: padX + 800, align: 'right' as const },
    { label: 'Разница (А − Б)', x: padX + tableW - 16, align: 'right' as const },
  ];

  ctx.fillStyle = '#F1F5F9';
  drawRoundedRect(ctx, padX, y, tableW, 44, 8);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = `700 14px ${fontSans}`;
  cmpCols.forEach((col) => {
    ctx.textAlign = col.align;
    ctx.fillText(col.label, col.x, y + 28);
  });
  ctx.textAlign = 'left';
  y += 44;

  const formatSigned = (n: number, suffix = '') =>
    `${n > 0 ? '+' : ''}${n.toLocaleString('ru-RU')}${suffix}`;

  const cmpRows = [
    {
      label: 'Аттестованные проводники в реестре',
      a: `${regA.certifiedInRegistry.toLocaleString('ru-RU')} чел.`,
      b: `${regB.certifiedInRegistry.toLocaleString('ru-RU')} чел.`,
      diff: formatSigned(regA.certifiedInRegistry - regB.certifiedInRegistry, ' чел.'),
    },
    {
      label: 'Расчётный спрос на проводников (2025)',
      a: `${regA.estimatedDemand.toLocaleString('ru-RU')} чел.`,
      b: `${regB.estimatedDemand.toLocaleString('ru-RU')} чел.`,
      diff: formatSigned(regA.estimatedDemand - regB.estimatedDemand, ' чел.'),
    },
    {
      label: 'Кадровый дефицит (спрос минус реестр)',
      a: `${mA.deficit.toLocaleString('ru-RU')} чел.`,
      b: `${mB.deficit.toLocaleString('ru-RU')} чел.`,
      diff: formatSigned(mA.deficit - mB.deficit, ' чел.'),
    },
    {
      label: 'Покрытие спроса действующим реестром',
      a: `${mA.coveragePct}%`,
      b: `${mB.coveragePct}%`,
      diff: `${mA.coveragePct - mB.coveragePct > 0 ? '+' : ''}${(
        Math.round((mA.coveragePct - mB.coveragePct) * 10) / 10
      ).toString()} п.п.`,
    },
    {
      label: 'Выпуск на сессии РЦА (окт. 2026)',
      a: `${regA.october2026Certified} чел.`,
      b: `${regB.october2026Certified} чел.`,
      diff: formatSigned(regA.october2026Certified - regB.october2026Certified, ' чел.'),
    },
    {
      label: 'Прогнозный спрос к 2030 г. (базовый сценарий)',
      a: `${mA.demand2030.toLocaleString('ru-RU')} чел.`,
      b: `${mB.demand2030.toLocaleString('ru-RU')} чел.`,
      diff: formatSigned(mA.demand2030 - mB.demand2030, ' чел.'),
    },
  ];

  cmpRows.forEach((row, idx) => {
    const rowH = 50;
    if (idx % 2 === 1) {
      ctx.fillStyle = '#FAFCFE';
      ctx.fillRect(padX, y, tableW, rowH);
    }
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y + rowH);
    ctx.lineTo(padX + tableW, y + rowH);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = `600 15px ${fontSans}`;
    ctx.fillText(row.label, cmpCols[0].x, y + 31);

    ctx.textAlign = 'right';
    ctx.font = `700 15px ${fontMono}`;
    ctx.fillStyle = '#0F766E';
    ctx.fillText(row.a, cmpCols[1].x, y + 31);

    ctx.fillStyle = '#B45309';
    ctx.fillText(row.b, cmpCols[2].x, y + 31);

    ctx.fillStyle = '#334155';
    ctx.fillText(row.diff, cmpCols[3].x, y + 31);
    ctx.textAlign = 'left';

    y += rowH;
  });

  // Executive Note Box
  y += 32;
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, padX, y, tableW, 132, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = `700 16px ${fontSans}`;
  ctx.fillText('Методическая справка и источники данных', padX + 24, y + 36);

  ctx.fillStyle = '#475569';
  ctx.font = `400 14px ${fontSans}`;
  ctx.fillText(
    '• Численность аттестованных проводников приведена по данным Единого федерального реестра инструкторов-проводников (Минэкономразвития РФ).',
    padX + 24,
    y + 66
  );
  ctx.fillText(
    '• Расчётный спрос и кадровый дефицит рассчитаны по модели ВВГУ и РЦА «Русский Восток» для активного туризма ДФО с учётом норм группового сопровождения.',
    padX + 24,
    y + 92
  );
  ctx.fillText(
    '• Портал исследования и аттестации: rca-vostok.ru · Базовая площадка: Институт туризма и креативных индустрий ВВГУ (г. Владивосток).',
    padX + 24,
    y + 118
  );

  // Footer
  ctx.strokeStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.moveTo(padX, H - 72);
  ctx.lineTo(W - padX, H - 72);
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = `500 13px ${fontSans}`;
  ctx.fillText('РЦА «Русский Восток» · Рабочий аналитический документ (формат А4)', padX, H - 40);
  ctx.textAlign = 'right';
  ctx.font = `500 13px ${fontMono}`;
  ctx.fillText('Стр. 1 / 1', W - padX, H - 40);
  ctx.textAlign = 'left';

  // Convert canvas to JPEG bytes and wrap inside PDF 1.4
  const dataUrl = canvas.toDataURL('image/jpeg', 0.93);
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const jpegBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    jpegBytes[i] = binary.charCodeAt(i);
  }

  const pdfBytes = wrapJpegBytesAsPdf(jpegBytes, W, H);
  const pdfCopy = new Uint8Array(pdfBytes.byteLength);
  pdfCopy.set(pdfBytes);
  const pdfBlob = new Blob([pdfCopy.buffer], { type: 'application/pdf' });
  const suffix = options.regionFilterId === 'all' ? 'dfo' : options.regionFilterId;
  triggerBlobDownload(
    pdfBlob,
    `rca-vostok-report-${suffix}-${new Date().toISOString().slice(0, 10)}.pdf`
  );
}
