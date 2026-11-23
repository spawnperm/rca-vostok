import { jsPDF } from 'jspdf';
import {
  BOTTLENECKS,
  DFO_REGIONAL_DEMAND_FORECAST_2025_2030,
  DFO_REGIONS_DISTRIBUTION,
  RECOMMENDATIONS,
  type HorizonStage,
} from '../data/researchData.ts';
import type {
  DemandForecastResult,
  DemandModelInput,
} from '../domain/certification/DemandForecastService.ts';
import {
  computeCalculatorScenarioProjection,
  type CalculatorScenarioProjection,
} from './calculatorScenario2030.ts';
import { getRegionDemand2030 } from './dfoReportExport.ts';
import { formatRussianDate } from './personalRoadmap.ts';

export interface CalculatorReportScenarioSummary {
  id: string;
  label: string;
  demand2030: number;
  projectedRegistry2030: number;
  residualDeficit2030: number;
  coverage2030Pct: number;
}

export interface CalculatorReportPayload {
  docNumber: string;
  exportedAtIso: string;
  exportedAtFormatted: string;
  presetLabel: string;
  scenarioLabel: string;
  scenarioAssumptions: string;
  inputs: {
    tAct: number;
    pOrg: number;
    gSize: number;
    groupsPerSeason: number;
    kSeason: number;
    kTurnover: number;
    registryCount: number;
    groupsPerYear: number;
    cohortSize: number;
    conversionRate: number;
  };
  currentResults: {
    baseDemand: number;
    totalDemand: number;
    deficit: number;
    gapMultiple: number;
    annualNewCertified: number;
  };
  projection2030: {
    demand2026: number;
    demand2030: number;
    growthPct: number;
    projectedRegistry2030: number;
    residualDeficit2030: number;
    coverage2030Pct: number;
    pOrg2030: number;
    kSeason2030: number;
  };
  yearlyRows: CalculatorScenarioProjection['yearly2026To2030'];
  allScenarios2030: CalculatorReportScenarioSummary[];
}

export interface MarketReportRegionRow {
  id: string;
  name: string;
  certifiedInRegistry: number;
  estimatedDemand: number;
  deficit: number;
  coveragePct: number;
  october2026Certified: number;
  demand2030: number;
}

export interface MarketReportPayload {
  docNumber: string;
  exportedAtIso: string;
  exportedAtFormatted: string;
  activeHorizonPeriod: string;
  activeHorizonArchetype: string;
  activeHorizonDrivers: string[];
  stakeholderFilter: string;
  totals: {
    registry: number;
    demand2025: number;
    deficit: number;
    coveragePct: number;
    october2026: number;
    demand2030Base: number;
    demand2030Conservative: number;
  };
  regions: MarketReportRegionRow[];
  bottlenecks: { index: string; title: string; impact: string }[];
  recommendations: { index: string; stakeholder: string; title: string; expectedEffect: string }[];
}

export function buildCalculatorReportPayload(params: {
  modelInput: DemandModelInput;
  results: DemandForecastResult;
  scenarioProjection: CalculatorScenarioProjection;
  presetLabel: string;
  now?: Date;
}): CalculatorReportPayload {
  const now = params.now ?? new Date();
  const exportedAtIso = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  const mmdd =
    String(now.getUTCMonth() + 1).padStart(2, '0') + String(now.getUTCDate()).padStart(2, '0');

  const scenarios: ('conservative' | 'baseline' | 'optimistic')[] = [
    'conservative',
    'baseline',
    'optimistic',
  ];
  const allScenarios2030: CalculatorReportScenarioSummary[] = scenarios.map((scId) => {
    const p = computeCalculatorScenarioProjection(params.modelInput, scId);
    return {
      id: p.option.id,
      label: p.option.label,
      demand2030: p.demand2030,
      projectedRegistry2030: p.projectedRegistry2030,
      residualDeficit2030: p.residualDeficit2030,
      coverage2030Pct: p.coverage2030Pct,
    };
  });

  return {
    docNumber: `РЦА-${year}/CALC-${mmdd}`,
    exportedAtIso,
    exportedAtFormatted: formatRussianDate(exportedAtIso),
    presetLabel: params.presetLabel,
    scenarioLabel: params.scenarioProjection.option.label,
    scenarioAssumptions: params.scenarioProjection.option.assumptionsNote,
    inputs: { ...params.modelInput },
    currentResults: {
      baseDemand: params.results.baseDemand,
      totalDemand: params.results.totalDemand,
      deficit: params.results.deficit,
      gapMultiple: params.results.gapMultiple,
      annualNewCertified: params.results.annualNewCertified,
    },
    projection2030: {
      demand2026: params.scenarioProjection.demand2026,
      demand2030: params.scenarioProjection.demand2030,
      growthPct: params.scenarioProjection.growthPct,
      projectedRegistry2030: params.scenarioProjection.projectedRegistry2030,
      residualDeficit2030: params.scenarioProjection.residualDeficit2030,
      coverage2030Pct: params.scenarioProjection.coverage2030Pct,
      pOrg2030: params.scenarioProjection.pOrg2030,
      kSeason2030: params.scenarioProjection.kSeason2030,
    },
    yearlyRows: params.scenarioProjection.yearly2026To2030,
    allScenarios2030,
  };
}

export function buildMarketReportPayload(params: {
  activeHorizon: HorizonStage;
  stakeholderFilter: string;
  now?: Date;
}): MarketReportPayload {
  const now = params.now ?? new Date();
  const exportedAtIso = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  const mmdd =
    String(now.getUTCMonth() + 1).padStart(2, '0') + String(now.getUTCDate()).padStart(2, '0');

  const registry = DFO_REGIONS_DISTRIBUTION.reduce((s, r) => s + r.certifiedInRegistry, 0);
  const demand2025 = DFO_REGIONS_DISTRIBUTION.reduce((s, r) => s + r.estimatedDemand, 0);
  const deficit = DFO_REGIONS_DISTRIBUTION.reduce(
    (s, r) => s + Math.max(0, r.estimatedDemand - r.certifiedInRegistry),
    0
  );
  const october2026 = DFO_REGIONS_DISTRIBUTION.reduce((s, r) => s + r.october2026Certified, 0);
  const coveragePct = demand2025 > 0 ? Math.round((registry / demand2025) * 1000) / 10 : 0;

  const baseLast =
    DFO_REGIONAL_DEMAND_FORECAST_2025_2030.base[
      DFO_REGIONAL_DEMAND_FORECAST_2025_2030.base.length - 1
    ];
  const conservativeLast =
    DFO_REGIONAL_DEMAND_FORECAST_2025_2030.conservative[
      DFO_REGIONAL_DEMAND_FORECAST_2025_2030.conservative.length - 1
    ];

  const regions: MarketReportRegionRow[] = DFO_REGIONS_DISTRIBUTION.map((reg) => {
    const regDeficit = Math.max(0, reg.estimatedDemand - reg.certifiedInRegistry);
    const regCov =
      reg.estimatedDemand > 0
        ? Math.round((reg.certifiedInRegistry / reg.estimatedDemand) * 1000) / 10
        : 0;
    return {
      id: reg.id,
      name: reg.name,
      certifiedInRegistry: reg.certifiedInRegistry,
      estimatedDemand: reg.estimatedDemand,
      deficit: regDeficit,
      coveragePct: regCov,
      october2026Certified: reg.october2026Certified,
      demand2030: getRegionDemand2030(reg.id),
    };
  });

  const recs =
    params.stakeholderFilter === 'all'
      ? RECOMMENDATIONS
      : RECOMMENDATIONS.filter((r) => r.stakeholder === params.stakeholderFilter);

  return {
    docNumber: `РЦА-${year}/MKT-${mmdd}`,
    exportedAtIso,
    exportedAtFormatted: formatRussianDate(exportedAtIso),
    activeHorizonPeriod: `${params.activeHorizon.horizon} (${params.activeHorizon.period})`,
    activeHorizonArchetype: params.activeHorizon.archetype,
    activeHorizonDrivers: [...params.activeHorizon.drivers],
    stakeholderFilter: params.stakeholderFilter === 'all' ? 'Все участники (7)' : params.stakeholderFilter,
    totals: {
      registry,
      demand2025,
      deficit,
      coveragePct,
      october2026,
      demand2030Base: baseLast?.totalDemand ?? 0,
      demand2030Conservative: conservativeLast?.totalDemand ?? 0,
    },
    regions,
    bottlenecks: BOTTLENECKS.map((b) => ({
      index: b.index,
      title: b.title,
      impact: b.impact,
    })),
    recommendations: recs.map((r) => ({
      index: r.index,
      stakeholder: r.stakeholder,
      title: r.title,
      expectedEffect: r.expectedEffect,
    })),
  };
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function createA4Canvas(
  docNumber: string,
  dateLabel: string,
  title: string,
  subtitle: string
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; startY: number } {
  const W = 1240;
  const H = 1754;
  const padX = 72;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось инициализировать графический контекст для создания PDF.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, 178);

  ctx.fillStyle = '#5eead4';
  ctx.font = 'bold 15px "DejaVu Sans", Arial, sans-serif';
  ctx.fillText('РЦА «РУССКИЙ ВОСТОК» · ВВГУ / ФСТР', padX, 50);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '14px "DejaVu Sans", Arial, sans-serif';
  ctx.fillText(`${docNumber} · ${dateLabel} г.`, W - padX, 50);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "DejaVu Sans", Arial, sans-serif';
  ctx.fillText(title, padX, 98);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '15px "DejaVu Sans", Arial, sans-serif';
  ctx.fillText(subtitle, padX, 138);

  return { canvas, ctx, startY: 214 };
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  leftNote: string,
  pageNumber: number,
  totalPages: number
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const padX = 72;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, H - 72);
  ctx.lineTo(W - padX, H - 72);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '13px "DejaVu Sans", Arial, sans-serif';
  ctx.fillText(leftNote, padX, H - 40);

  ctx.textAlign = 'right';
  ctx.fillText(`Стр. ${pageNumber} из ${totalPages}`, W - padX, H - 40);
  ctx.textAlign = 'left';
}

function saveCanvasesAsJsPdf(canvases: HTMLCanvasElement[], fileName: string): void {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  canvases.forEach((canvas, idx) => {
    if (idx > 0) {
      pdf.addPage('a4', 'portrait');
    }
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
  });

  pdf.save(fileName);
}

export function exportCalculatorAnalyticsPdf(params: {
  modelInput: DemandModelInput;
  results: DemandForecastResult;
  scenarioProjection: CalculatorScenarioProjection;
  presetLabel: string;
}): { fileName: string; payload: CalculatorReportPayload } {
  const payload = buildCalculatorReportPayload(params);
  const padX = 72;
  const W = 1240;
  const contentW = W - padX * 2;

  const { canvas, ctx, startY } = createA4Canvas(
    payload.docNumber,
    payload.exportedAtFormatted,
    'Аналитический отчёт: прогноз потребности до 2030 г.',
    `Калькулятор модели ВВГУ · Пресет: ${payload.presetLabel} · Сценарий: ${payload.scenarioLabel}`
  );

  let y = startY;

  // Section 1: KPI grid
  const kpiGap = 18;
  const kpiW = (contentW - kpiGap * 3) / 4;
  const kpiH = 112;
  const kpis = [
    {
      label: 'Потребность сейчас (N)',
      value: `${payload.currentResults.totalDemand.toLocaleString('ru-RU')} чел.`,
      sub: `База без коэф.: ${payload.currentResults.baseDemand.toLocaleString('ru-RU')}`,
      color: '#0f766e',
    },
    {
      label: 'Текущий дефицит',
      value: `${payload.currentResults.deficit.toLocaleString('ru-RU')} чел.`,
      sub: `Разрыв ${payload.currentResults.gapMultiple.toFixed(1)}× к реестру`,
      color: '#b91c1c',
    },
    {
      label: 'Прогноз спроса 2030 г.',
      value: `${payload.projection2030.demand2030.toLocaleString('ru-RU')} чел.`,
      sub: `Рост +${payload.projection2030.growthPct}% к базе`,
      color: '#0f172a',
    },
    {
      label: 'Реестр ВВГУ к 2030 г.',
      value: `${payload.projection2030.projectedRegistry2030.toLocaleString('ru-RU')} чел.`,
      sub: `Покрытие ${payload.projection2030.coverage2030Pct}% · дефицит ${payload.projection2030.residualDeficit2030}`,
      color: '#b45309',
    },
  ];

  kpis.forEach((k, idx) => {
    const x = padX + idx * (kpiW + kpiGap);
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, kpiW, kpiH);
    ctx.strokeRect(x, y, kpiW, kpiH);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 13px "DejaVu Sans", Arial, sans-serif';
    ctx.fillText(k.label, x + 16, y + 30);

    ctx.fillStyle = k.color;
    ctx.font = 'bold 24px "DejaVu Sans", Arial, sans-serif';
    ctx.fillText(k.value, x + 16, y + 68);

    ctx.fillStyle = '#475569';
    ctx.font = '12px "DejaVu Sans", Arial, sans-serif';
    ctx.fillText(k.sub, x + 16, y + 95);
  });

  y += kpiH + 40;

  // Section 2: Input parameters
  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 14px "DejaVu Sans", Arial, sans-serif';
  ctx.fillText('1. ВХОДНЫЕ ПАРАМЕТРЫ ЭКОНОМИКО-МАТЕМАТИЧЕСКОЙ МОДЕЛИ', padX, y);
  y += 22;

  const paramLines = [
    `• Активный турпоток (T_act): ${payload.inputs.tAct.toLocaleString('ru-RU')} чел./год   ·   Доля организованных групп (P_org): ${payload.inputs.pOrg}%`,
    `• Размер группы (G_size): ${payload.inputs.gSize} чел.   ·   Норма групп за сезон (G_season): ${payload.inputs.groupsPerSeason}   ·   Текущий реестр: ${payload.inputs.registryCount} чел.`,
    `• Сезонность (K_season): ${payload.inputs.kSeason.toFixed(2)}   ·   Текучесть (K_turnover): ${payload.inputs.kTurnover.toFixed(2)}   ·   План ВВГУ: ${payload.inputs.groupsPerYear} гр. × ${payload.inputs.cohortSize} чел. (${payload.inputs.conversionRate}% конв. = +${payload.currentResults.annualNewCertified}/год)`,
  ];

  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#e2e8f0';
  ctx.fillRect(padX, y, contentW, 108);
  ctx.strokeRect(padX, y, contentW, 108);

  ctx.fillStyle = '#1e293b';
  ctx.font = '14px "DejaVu Sans", Arial, sans-serif';
  paramLines.forEach((line, idx) => {
    ctx.fillText(line, padX + 20, y + 32 + idx * 28);
  });

  y += 144;

  // Section 3: 2026-2030 yearly dynamics table
  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 14px "DejaVu Sans", Arial, sans-serif';
  ctx.fillText(`2. ПОГОДОВАЯ ТРАЕКТОРИЯ 2026–2030 ГГ. (${payload.scenarioLabel.toUpperCase()})`, padX, y);
  y += 16;
  ctx.fillStyle = '#64748b';
  ctx.font = '13px "DejaVu Sans", Arial, sans-serif';
  ctx.fillText(payload.scenarioAssumptions, padX, y + 12);
  y += 30;

  const cols = [
    { label: 'Год', x: padX + 20, align: 'left' as const },
    { label: 'Целевой спрос (чел.)', x: padX + 340, align: 'right' as const },
    { label: 'Прогноз реестра ВВГУ', x: padX + 610, align: 'right' as const },
    { label: 'Остаточный дефицит', x: padX + 860, align: 'right' as const },
    { label: 'Покрытие спроса', x: padX + contentW - 20, align: 'right' as const },
  ];

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(padX, y, contentW, 44);
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 14px "DejaVu Sans", Arial, sans-serif';
  cols.forEach((c) => {
    ctx.textAlign = c.align;
    ctx.fillText(c.label, c.x, y + 28);
  });
  ctx.textAlign = 'left';
  y += 44;

  payload.yearlyRows.forEach((row, idx) => {
    const rowH = 50;
    if (idx % 2 === 1) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(padX, y, contentW, rowH);
    }
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(padX, y + rowH);
    ctx.lineTo(padX + contentW, y + rowH);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px "DejaVu Sans", Arial, sans-serif';
    ctx.fillText(`${row.year} г.`, cols[0].x, y + 31);

    ctx.textAlign = 'right';
    ctx.font = '16px "DejaVu Sans", Arial, sans-serif';
    ctx.fillText(row.targetDemand.toLocaleString('ru-RU'), cols[1].x, y + 31);

    ctx.fillStyle = '#0f766e';
    ctx.font = 'bold 16px "DejaVu Sans", Arial, sans-serif';
    ctx.fillText(row.projectedRegistry.toLocaleString('ru-RU'), cols[2].x, y + 31);

    ctx.fillStyle = '#b91c1c';
    ctx.font = '16px "DejaVu Sans", Arial, sans-serif';
    ctx.fillText(row.deficit.toLocaleString('ru-RU'), cols[3].x, y + 31);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px "DejaVu Sans", Arial, sans-serif';
    ctx.fillText(`${row.coveragePct}%`, cols[4].x, y + 31);
    ctx.textAlign = 'left';

    y += rowH;
  });

  y += 44;

  // Section 4: Comparison of all 3 scenarios to 2030
  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 14px "DejaVu Sans", Arial, sans-serif';
  ctx.fillText('3. СРАВНЕНИЕ ВСЕХ СЦЕНАРИЕВ РАЗВИТИЯ ТУРПОТОКА ДФО К 2030 ГОДУ', padX, y);
  y += 22;

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(padX, y, contentW, 44);
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 14px "DejaVu Sans", Arial, sans-serif';
  const scCols = [
    { label: 'Сценарий к 2030 г.', x: padX + 20, align: 'left' as const },
    { label: 'Потребность 2030', x: padX + 460, align: 'right' as const },
    { label: 'Реестр ВВГУ 2030', x: padX + 700, align: 'right' as const },
    { label: 'Дефицит 2030', x: padX + 910, align: 'right' as const },
    { label: 'Покрытие', x: padX + contentW - 20, align: 'right' as const },
  ];
  scCols.forEach((c) => {
    ctx.textAlign = c.align;
    ctx.fillText(c.label, c.x, y + 28);
  });
  ctx.textAlign = 'left';
  y += 44;

  payload.allScenarios2030.forEach((sc) => {
    const rowH = 52;
    const isActive = sc.label === payload.scenarioLabel;
    if (isActive) {
      ctx.fillStyle = '#f0fdfa';
      ctx.fillRect(padX, y, contentW, rowH);
    }
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(padX, y + rowH);
    ctx.lineTo(padX + contentW, y + rowH);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = isActive ? '#0f766e' : '#0f172a';
    ctx.font = `${isActive ? 'bold ' : ''}15px "DejaVu Sans", Arial, sans-serif`;
    ctx.fillText(`${sc.label}${isActive ? ' (выбран)' : ''}`, scCols[0].x, y + 32);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px "DejaVu Sans", Arial, sans-serif';
    ctx.fillText(`${sc.demand2030.toLocaleString('ru-RU')} чел.`, scCols[1].x, y + 32);

    ctx.fillStyle = '#0f766e';
    ctx.fillText(`${sc.projectedRegistry2030.toLocaleString('ru-RU')} чел.`, scCols[2].x, y + 32);

    ctx.fillStyle = '#b91c1c';
    ctx.fillText(`${sc.residualDeficit2030.toLocaleString('ru-RU')} чел.`, scCols[3].x, y + 32);

    ctx.fillStyle = '#0f172a';
    ctx.fillText(`${sc.coverage2030Pct}%`, scCols[4].x, y + 32);
    ctx.textAlign = 'left';

    y += rowH;
  });

  y += 42;

  // Formula box
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.fillRect(padX, y, contentW, 118);
  ctx.strokeRect(padX, y, contentW, 118);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px "DejaVu Sans", Arial, sans-serif';
  ctx.fillText('Формула расчёта и методика модели', padX + 20, y + 32);

  ctx.fillStyle = '#334155';
  ctx.font = '14px "DejaVu Sans", Arial, sans-serif';
  ctx.fillText(
    'N = ((T_act × P_org) / G_size / G_season) × K_season × K_turnover',
    padX + 20,
    y + 62
  );
  ctx.fillStyle = '#64748b';
  ctx.font = '13px "DejaVu Sans", Arial, sans-serif';
  ctx.fillText(
    'Источник данных: исследование Института туризма и креативных индустрий ВВГУ и РЦА «Русский Восток» (rca-vostok.ru).',
    padX + 20,
    y + 92
  );

  drawFooter(ctx, 'РЦА «Русский Восток» · Отчёт калькулятора кадровой модели до 2030 г.', 1, 1);

  const fileName = `RCA_Vostok_Calculator_2030_${payload.exportedAtIso}.pdf`;
  saveCanvasesAsJsPdf([canvas], fileName);
  return { fileName, payload };
}

export function exportMarketAnalyticsPdf(params: {
  activeHorizon: HorizonStage;
  stakeholderFilter: string;
}): { fileName: string; payload: MarketReportPayload } {
  const payload = buildMarketReportPayload(params);
  const padX = 72;
  const W = 1240;
  const contentW = W - padX * 2;

  // Page 1: Regional Market Totals + 7 DFO Regions Table + Forecast Horizon
  const page1 = createA4Canvas(
    payload.docNumber,
    payload.exportedAtFormatted,
    'Аналитический отчёт по рынку инструкторов ДФО',
    `Срез рынка труда · Горизонт: ${payload.activeHorizonPeriod} · Фильтр мер: ${payload.stakeholderFilter}`
  );
  const ctx1 = page1.ctx;
  let y = page1.startY;

  const kpiGap = 18;
  const kpiW = (contentW - kpiGap * 3) / 4;
  const kpiH = 112;
  const kpis = [
    {
      label: 'В реестре по ДФО',
      value: `${payload.totals.registry.toLocaleString('ru-RU')} чел.`,
      sub: `Выпуск окт. 2026: +${payload.totals.october2026}`,
      color: '#0f766e',
    },
    {
      label: 'Расчётный спрос 2025',
      value: `${payload.totals.demand2025.toLocaleString('ru-RU')} чел.`,
      sub: 'Активный туризм (7 регионов)',
      color: '#0f172a',
    },
    {
      label: 'Кадровый дефицит',
      value: `${payload.totals.deficit.toLocaleString('ru-RU')} чел.`,
      sub: `Покрытие спроса: ${payload.totals.coveragePct}%`,
      color: '#b91c1c',
    },
    {
      label: 'Прогноз 2030 (база / консерв.)',
      value: `${payload.totals.demand2030Base.toLocaleString('ru-RU')} / ${payload.totals.demand2030Conservative.toLocaleString('ru-RU')}`,
      sub: 'Базовый / умеренный рост ДФО',
      color: '#b45309',
    },
  ];

  kpis.forEach((k, idx) => {
    const x = padX + idx * (kpiW + kpiGap);
    ctx1.fillStyle = '#f8fafc';
    ctx1.strokeStyle = '#cbd5e1';
    ctx1.lineWidth = 1.5;
    ctx1.fillRect(x, y, kpiW, kpiH);
    ctx1.strokeRect(x, y, kpiW, kpiH);

    ctx1.fillStyle = '#64748b';
    ctx1.font = 'bold 13px "DejaVu Sans", Arial, sans-serif';
    ctx1.fillText(k.label, x + 16, y + 30);

    ctx1.fillStyle = k.color;
    ctx1.font = 'bold 23px "DejaVu Sans", Arial, sans-serif';
    ctx1.fillText(k.value, x + 16, y + 68);

    ctx1.fillStyle = '#475569';
    ctx1.font = '12px "DejaVu Sans", Arial, sans-serif';
    ctx1.fillText(k.sub, x + 16, y + 95);
  });

  y += kpiH + 40;

  ctx1.fillStyle = '#0f766e';
  ctx1.font = 'bold 14px "DejaVu Sans", Arial, sans-serif';
  ctx1.fillText('1. РЕГИОНАЛЬНАЯ СТРУКТУРА РЫНКА ДФО (7 СУБЪЕКТОВ)', padX, y);
  y += 22;

  const cols = [
    { label: 'Субъект ДФО', x: padX + 16, align: 'left' as const },
    { label: 'В реестре', x: padX + 430, align: 'right' as const },
    { label: 'Спрос 2025', x: padX + 585, align: 'right' as const },
    { label: 'Дефицит', x: padX + 735, align: 'right' as const },
    { label: 'Покрытие', x: padX + 870, align: 'right' as const },
    { label: 'Прогноз 2030', x: padX + contentW - 16, align: 'right' as const },
  ];

  ctx1.fillStyle = '#f1f5f9';
  ctx1.fillRect(padX, y, contentW, 44);
  ctx1.fillStyle = '#475569';
  ctx1.font = 'bold 14px "DejaVu Sans", Arial, sans-serif';
  cols.forEach((c) => {
    ctx1.textAlign = c.align;
    ctx1.fillText(c.label, c.x, y + 28);
  });
  ctx1.textAlign = 'left';
  y += 44;

  payload.regions.forEach((reg, idx) => {
    const rowH = 50;
    if (idx % 2 === 1) {
      ctx1.fillStyle = '#f8fafc';
      ctx1.fillRect(padX, y, contentW, rowH);
    }
    ctx1.strokeStyle = '#e2e8f0';
    ctx1.beginPath();
    ctx1.moveTo(padX, y + rowH);
    ctx1.lineTo(padX + contentW, y + rowH);
    ctx1.stroke();

    ctx1.textAlign = 'left';
    ctx1.fillStyle = '#0f172a';
    ctx1.font = 'bold 15px "DejaVu Sans", Arial, sans-serif';
    ctx1.fillText(reg.name, cols[0].x, y + 31);

    ctx1.textAlign = 'right';
    ctx1.fillStyle = '#0f766e';
    ctx1.font = 'bold 15px "DejaVu Sans", Arial, sans-serif';
    ctx1.fillText(reg.certifiedInRegistry.toLocaleString('ru-RU'), cols[1].x, y + 31);

    ctx1.fillStyle = '#0f172a';
    ctx1.font = '15px "DejaVu Sans", Arial, sans-serif';
    ctx1.fillText(reg.estimatedDemand.toLocaleString('ru-RU'), cols[2].x, y + 31);

    ctx1.fillStyle = '#b91c1c';
    ctx1.fillText(reg.deficit.toLocaleString('ru-RU'), cols[3].x, y + 31);

    ctx1.fillStyle = '#334155';
    ctx1.fillText(`${reg.coveragePct}%`, cols[4].x, y + 31);

    ctx1.fillStyle = '#0f172a';
    ctx1.font = 'bold 15px "DejaVu Sans", Arial, sans-serif';
    ctx1.fillText(reg.demand2030.toLocaleString('ru-RU'), cols[5].x, y + 31);
    ctx1.textAlign = 'left';

    y += rowH;
  });

  // Totals bar
  ctx1.fillStyle = '#0f172a';
  ctx1.fillRect(padX, y + 4, contentW, 48);
  ctx1.fillStyle = '#ffffff';
  ctx1.font = 'bold 15px "DejaVu Sans", Arial, sans-serif';
  ctx1.fillText('Итого по ДФО (7 регионов)', cols[0].x, y + 34);
  ctx1.textAlign = 'right';
  ctx1.fillStyle = '#5eead4';
  ctx1.fillText(payload.totals.registry.toLocaleString('ru-RU'), cols[1].x, y + 34);
  ctx1.fillStyle = '#ffffff';
  ctx1.fillText(payload.totals.demand2025.toLocaleString('ru-RU'), cols[2].x, y + 34);
  ctx1.fillStyle = '#fca5a5';
  ctx1.fillText(payload.totals.deficit.toLocaleString('ru-RU'), cols[3].x, y + 34);
  ctx1.fillStyle = '#ffffff';
  ctx1.fillText(`${payload.totals.coveragePct}%`, cols[4].x, y + 34);
  ctx1.fillText(payload.totals.demand2030Base.toLocaleString('ru-RU'), cols[5].x, y + 34);
  ctx1.textAlign = 'left';

  y += 96;

  // Horizon Highlight Box
  ctx1.fillStyle = '#0f766e';
  ctx1.font = 'bold 14px "DejaVu Sans", Arial, sans-serif';
  ctx1.fillText(`2. ПРОФИЛЬ ВОСТРЕБОВАННОСТИ · ${payload.activeHorizonPeriod.toUpperCase()}`, padX, y);
  y += 20;

  ctx1.fillStyle = '#f8fafc';
  ctx1.strokeStyle = '#cbd5e1';
  ctx1.fillRect(padX, y, contentW, 210);
  ctx1.strokeRect(padX, y, contentW, 210);

  ctx1.fillStyle = '#0f172a';
  ctx1.font = 'bold 19px "DejaVu Sans", Arial, sans-serif';
  ctx1.fillText(payload.activeHorizonArchetype, padX + 24, y + 38);

  let hy = y + 72;
  ctx1.fillStyle = '#334155';
  ctx1.font = '14px "DejaVu Sans", Arial, sans-serif';
  payload.activeHorizonDrivers.slice(0, 3).forEach((drv) => {
    const lines = wrapTextLines(ctx1, `• ${drv}`, contentW - 48);
    lines.forEach((line) => {
      if (hy < y + 196) {
        ctx1.fillText(line, padX + 24, hy);
        hy += 22;
      }
    });
  });

  drawFooter(ctx1, 'РЦА «Русский Восток» · Рынок труда инструкторов-проводников ДФО', 1, 2);

  // Page 2: Bottlenecks + Strategic Recommendations
  const page2 = createA4Canvas(
    payload.docNumber,
    payload.exportedAtFormatted,
    'Узкие места и дорожная карта преодоления дефицита',
    `Структурные риски рынка ДФО и меры для: ${payload.stakeholderFilter}`
  );
  const ctx2 = page2.ctx;
  let y2 = page2.startY;

  ctx2.fillStyle = '#b91c1c';
  ctx2.font = 'bold 14px "DejaVu Sans", Arial, sans-serif';
  ctx2.fillText('3. ПЯТЬ СТРУКТУРНЫХ «УЗКИХ МЕСТ» РЫНКА', padX, y2);
  y2 += 22;

  payload.bottlenecks.forEach((b) => {
    ctx2.fillStyle = '#f8fafc';
    ctx2.strokeStyle = '#e2e8f0';
    ctx2.fillRect(padX, y2, contentW, 74);
    ctx2.strokeRect(padX, y2, contentW, 74);

    ctx2.fillStyle = '#0f172a';
    ctx2.font = 'bold 15px "DejaVu Sans", Arial, sans-serif';
    ctx2.fillText(`${b.index}. ${b.title}`, padX + 18, y2 + 28);

    ctx2.fillStyle = '#0f766e';
    ctx2.font = '13px "DejaVu Sans", Arial, sans-serif';
    const impactLines = wrapTextLines(ctx2, b.impact, contentW - 36);
    ctx2.fillText(impactLines[0] ?? '', padX + 18, y2 + 54);

    y2 += 86;
  });

  y2 += 24;
  ctx2.fillStyle = '#0f766e';
  ctx2.font = 'bold 14px "DejaVu Sans", Arial, sans-serif';
  ctx2.fillText(`4. РЕКОМЕНДУЕМЫЕ МЕРЫ (${payload.stakeholderFilter.toUpperCase()})`, padX, y2);
  y2 += 22;

  payload.recommendations.slice(0, 7).forEach((rec) => {
    if (y2 > 1580) return;
    ctx2.fillStyle = '#ffffff';
    ctx2.strokeStyle = '#cbd5e1';
    ctx2.fillRect(padX, y2, contentW, 92);
    ctx2.strokeRect(padX, y2, contentW, 92);

    ctx2.fillStyle = '#0f766e';
    ctx2.font = 'bold 12px "DejaVu Sans", Arial, sans-serif';
    ctx2.fillText(`МЕРА ${rec.index} · ${rec.stakeholder.toUpperCase()}`, padX + 18, y2 + 24);

    ctx2.fillStyle = '#0f172a';
    ctx2.font = 'bold 15px "DejaVu Sans", Arial, sans-serif';
    ctx2.fillText(rec.title, padX + 18, y2 + 48);

    ctx2.fillStyle = '#475569';
    ctx2.font = '13px "DejaVu Sans", Arial, sans-serif';
    const effLines = wrapTextLines(ctx2, `Эффект: ${rec.expectedEffect}`, contentW - 36);
    ctx2.fillText(effLines[0] ?? '', padX + 18, y2 + 72);

    y2 += 104;
  });

  drawFooter(ctx2, 'РЦА «Русский Восток» · ВВГУ / ФСТР · rca-vostok.ru', 2, 2);

  const fileName = `RCA_Vostok_Market_DFO_${payload.exportedAtIso}.pdf`;
  saveCanvasesAsJsPdf([page1.canvas, page2.canvas], fileName);
  return { fileName, payload };
}
