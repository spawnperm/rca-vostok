import { jsPDF } from 'jspdf';
import {
  DIAGNOSTIC_SECTIONS,
  type DiagnosticSectionId,
} from './attestationSelfDiagnostics.ts';
import type { PreparationContour } from './personalRoadmap.ts';

export type LearningPrepLevelId = 'initial' | 'intermediate' | 'advanced';

export interface LearningPrepLevelMeta {
  id: LearningPrepLevelId;
  label: string;
  targetCategory: string;
  baseHours: number;
  description: string;
}

export const LEARNING_PREP_LEVELS: readonly LearningPrepLevelMeta[] = [
  {
    id: 'initial',
    label: 'Начальный уровень (стаж до 1 года)',
    targetCategory: '1 категория сложности (базовый старт)',
    baseHours: 16,
    description:
      'Системная подготовка с акцентом на законодательство РФ, паспортизацию маршрута и базовые навыки первой помощи.',
  },
  {
    id: 'intermediate',
    label: 'Базовый практик (опыт 1–3 года)',
    targetCategory: '1–2 категория сложности (коммерческий допуск)',
    baseHours: 10,
    description:
      'Устранение точечных пробелов по формам ПП РФ № 760, ООПТ и отработка тактики на маршруте перед экзаменом.',
  },
  {
    id: 'advanced',
    label: 'Продвинутый / Экспедиционный (3+ лет)',
    targetCategory: '3–4 категория сложности (повышенная сложность)',
    baseHours: 6,
    description:
      'Интенсивная сверка паспорта сложного маршрута, протоколов ПСР/WFA и верификация походного стажа.',
  },
];

export interface LearningPlanModule {
  order: number;
  domainId: DiagnosticSectionId;
  title: string;
  priorityLabel: 'Высокий приоритет (пробел)' | 'Плановое закрепление';
  isGap: boolean;
  hours: number;
  timeframeLabel: string;
  actions: readonly string[];
  deliverable: string;
}

export interface PersonalLearningPlanModel {
  candidateName: string;
  region: string;
  level: LearningPrepLevelMeta;
  contour: PreparationContour;
  contourLabel: string;
  gapDomainIds: DiagnosticSectionId[];
  totalHours: number;
  recommendedWeeks: number;
  modules: LearningPlanModule[];
  generatedAtIso: string;
  generatedAtFormatted: string;
  docCode: string;
}

export interface GeneratedLearningPlanPdf {
  fileName: string;
  plan: PersonalLearningPlanModel;
  previewDataUrl: string;
  pdfBlobUrl: string;
}

const DOMAIN_DELIVERABLES: Record<DiagnosticSectionId, string> = {
  regulation: 'Собранный комплект документов для подачи в РЦА + уверенное прохождение теста по НПА',
  routing: 'Готовый проект паспорта маршрута (ПП РФ № 760) с аварийными выходами и схемой ООПТ',
  first_aid: 'Отработанный алгоритм WFA, укомплектованная аптечка и навыки страховки на переправе',
  field_dfo: 'Чек-лист связи Garmin inReach / МЧС и сценарий реагирования на паводки и встречи с хищниками',
};

function buildPlanDocCode(seed: string, now: Date): string {
  const year = now.getUTCFullYear();
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 37 + seed.charCodeAt(i)) % 9000;
  }
  const suffix = String(1000 + Math.abs(hash)).padStart(4, '0');
  return `РЦА-ИПО-${year}-${suffix}`;
}

export function buildPersonalLearningPlanModel(params: {
  candidateName: string;
  region: string;
  levelId: LearningPrepLevelId;
  gapDomainIds: DiagnosticSectionId[];
  contour: PreparationContour;
  now?: Date;
}): PersonalLearningPlanModel {
  const now = params.now ?? new Date();
  const level =
    LEARNING_PREP_LEVELS.find((l) => l.id === params.levelId) ?? LEARNING_PREP_LEVELS[1];
  const gapSet = new Set<DiagnosticSectionId>(params.gapDomainIds);
  const contourLabel =
    params.contour === 'contour_a'
      ? 'Контур А (зачёт стажа практиков)'
      : 'Контур Б (обучение ДПО ВВГУ + экзамен)';

  const levelMultiplier = level.id === 'initial' ? 1.5 : level.id === 'intermediate' ? 1 : 0.75;

  // Order gap domains first so the roadmap immediately addresses weak spots
  const sortedSections = [...DIAGNOSTIC_SECTIONS].sort((a, b) => {
    const aGap = gapSet.has(a.id) ? 0 : 1;
    const bGap = gapSet.has(b.id) ? 0 : 1;
    if (aGap !== bGap) return aGap - bGap;
    return a.stepNumber - b.stepNumber;
  });

  let cumulativeWeek = 1;
  const modules: LearningPlanModule[] = sortedSections.map((sec, idx) => {
    const isGap = gapSet.has(sec.id);
    const rawHours = isGap ? sec.estimatedGapHours : sec.estimatedModerateHours;
    const hours = Math.max(2, Math.round(rawHours * levelMultiplier));
    const durationWeeks = hours >= 6 ? 2 : 1;
    const startW = cumulativeWeek;
    const endW = cumulativeWeek + durationWeeks - 1;
    cumulativeWeek += durationWeeks;

    return {
      order: idx + 1,
      domainId: sec.id,
      title: sec.title,
      priorityLabel: isGap ? 'Высокий приоритет (пробел)' : 'Плановое закрепление',
      isGap,
      hours,
      timeframeLabel: startW === endW ? `Неделя ${startW}` : `Недели ${startW}–${endW}`,
      actions: sec.studyActions,
      deliverable: DOMAIN_DELIVERABLES[sec.id],
    };
  });

  const totalHours = modules.reduce((sum, m) => sum + m.hours, 0);
  const recommendedWeeks = Math.max(2, cumulativeWeek - 1);
  const generatedAtIso = now.toISOString().slice(0, 10);
  const generatedAtFormatted = now.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return {
    candidateName: params.candidateName.trim() || 'Соискатель РЦА «Русский Восток»',
    region: params.region.trim() || 'Приморский край',
    level,
    contour: params.contour,
    contourLabel,
    gapDomainIds: Array.from(gapSet),
    totalHours,
    recommendedWeeks,
    modules,
    generatedAtIso,
    generatedAtFormatted,
    docCode: buildPlanDocCode(
      `${params.candidateName}-${level.id}-${Array.from(gapSet).join(',')}`,
      now
    ),
  };
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function renderLearningPlanCanvas(plan: PersonalLearningPlanModel): HTMLCanvasElement {
  const W = 1654;
  const H = 2339;
  const marginX = 110;
  const contentW = W - marginX * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось инициализировать Canvas для PDF-дорожной карты.');
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Top bar
  ctx.fillStyle = '#0F766E';
  ctx.fillRect(0, 0, W, 18);

  let y = 94;
  ctx.fillStyle = '#0F766E';
  ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('РЦА «РУССКИЙ ВОСТОК» · ВВГУ · ЛИЧНЫЙ КАБИНЕТ ИНСТРУКТОРА', marginX, y);

  y += 42;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 36px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('ИНДИВИДУАЛЬНАЯ ДОРОЖНАЯ КАРТА ОБУЧЕНИЯ', marginX, y);

  y += 32;
  ctx.fillStyle = '#475569';
  ctx.font = '20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `Код плана: ${plan.docCode} · Сформировано: ${plan.generatedAtFormatted} г.`,
    marginX,
    y
  );

  y += 26;
  ctx.strokeStyle = '#0F766E';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(marginX, y);
  ctx.lineTo(W - marginX, y);
  ctx.stroke();

  // Summary card
  y += 32;
  const summaryRows: [string, string][] = [
    ['Инструктор / соискатель:', plan.candidateName],
    ['Субъект ДФО:', plan.region],
    ['Уровень подготовки:', plan.level.label],
    ['Целевая категория:', plan.level.targetCategory],
    ['Образовательный трек:', plan.contourLabel],
    [
      'Объём и горизонт плана:',
      `${plan.totalHours} ак. ч. · расчётный срок ${plan.recommendedWeeks} нед.`,
    ],
  ];
  const rowH = 44;
  const boxH = summaryRows.length * rowH + 28;
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.fillRect(marginX, y, contentW, boxH);
  ctx.strokeRect(marginX, y, contentW, boxH);

  summaryRows.forEach(([label, val], idx) => {
    const ry = y + 40 + idx * rowH;
    ctx.fillStyle = '#475569';
    ctx.font = '19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(label, marginX + 24, ry);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(val, marginX + 380, ry);
  });

  // Modules Roadmap
  y += boxH + 46;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 26px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Приоритетные модули подготовки по результатам диагностики', marginX, y);

  y += 26;
  for (const mod of plan.modules) {
    const modBoxY = y;
    // Measure wrapped lines to compute card height dynamically
    ctx.font = '18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const actionLinesList = mod.actions
      .slice(0, 2)
      .flatMap((act) => wrapLines(ctx, `• ${act}`, contentW - 56));
    const delivLines = wrapLines(ctx, `Итог модуля: ${mod.deliverable}`, contentW - 56);
    const cardH = 92 + actionLinesList.length * 26 + delivLines.length * 25 + 18;

    ctx.fillStyle = mod.isGap ? '#FFFBEB' : '#FFFFFF';
    ctx.strokeStyle = mod.isGap ? '#F59E0B' : '#CBD5E1';
    ctx.lineWidth = mod.isGap ? 2 : 1.4;
    ctx.fillRect(marginX, modBoxY, contentW, cardH);
    ctx.strokeRect(marginX, modBoxY, contentW, cardH);

    // Module title
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 21px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(`Модуль 0${mod.order}. ${mod.title}`, marginX + 24, modBoxY + 36);

    // Priority + hours pill text on right
    ctx.textAlign = 'right';
    ctx.fillStyle = mod.isGap ? '#B45309' : '#0F766E';
    ctx.font = 'bold 18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(
      `${mod.priorityLabel} · ${mod.hours} ч · ${mod.timeframeLabel}`,
      W - marginX - 24,
      modBoxY + 36
    );
    ctx.textAlign = 'left';

    let textY = modBoxY + 72;
    ctx.fillStyle = '#334155';
    ctx.font = '18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    for (const line of actionLinesList) {
      ctx.fillText(line, marginX + 24, textY);
      textY += 26;
    }

    textY += 6;
    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    for (const dLine of delivLines) {
      ctx.fillText(dLine, marginX + 24, textY);
      textY += 25;
    }

    y += cardH + 22;
  }

  // Advisory Footer
  const footerY = H - 84;
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX, footerY - 28);
  ctx.lineTo(W - marginX, footerY - 28);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `РЦА «Русский Восток» · ИТКИ ВВГУ (г. Владивосток) · Индивидуальная дорожная карта ${plan.docCode}`,
    marginX,
    footerY
  );

  return canvas;
}

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'instructor'
  );
}

export function generatePersonalLearningPlanPdf(params: {
  candidateName: string;
  region: string;
  levelId: LearningPrepLevelId;
  gapDomainIds: DiagnosticSectionId[];
  contour: PreparationContour;
}): GeneratedLearningPlanPdf {
  const plan = buildPersonalLearningPlanModel(params);
  const canvas = renderLearningPlanCanvas(plan);
  const previewDataUrl = canvas.toDataURL('image/png');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pdf.addImage(previewDataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

  const fileName = `Learning_Plan_RCA_${slugify(plan.candidateName)}_${plan.generatedAtIso}.pdf`;
  const pdfBlob = pdf.output('blob');
  const pdfBlobUrl = URL.createObjectURL(pdfBlob);

  pdf.save(fileName);

  return {
    fileName,
    plan,
    previewDataUrl,
    pdfBlobUrl,
  };
}
