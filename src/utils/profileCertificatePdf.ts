import { ROLE_LABELS, type SessionUser } from './identityApi.ts';
import type { UserAttestationSummary } from '../components/AttestationProgressWidget.tsx';
import type { InquiryRecord } from '../components/social/MyInquiriesSection.tsx';
import {
  deterministicHash,
  drawVerificationMatrix,
  exportCanvasAsA4PortraitPdf,
  sanitizeFileSlug,
  truncateTextToFit,
} from './pdfCanvasHelpers.ts';
import { formatRussianDate, type PreparationContour } from './personalRoadmap.ts';

export const PROFILE_CERTIFICATE_TRACKS = [
  'Пешеходный туризм',
  'Водный туризм',
  'Горный туризм',
  'Спелеотуризм',
  'Лыжный и снегоходный туризм',
  'Велосипедный и авто-мото туризм',
  'Комбинированный профиль (пеший / водный)',
] as const;

export const PROFILE_CERTIFICATE_CATEGORIES = [
  '1 КС (маршруты начальной сложности)',
  '2 КС (маршруты средней сложности)',
  '3 КС (маршруты повышенной сложности)',
  '4 КС (сложные экспедиционные маршруты)',
  'Базовый уровень (подготовка к аттестации)',
] as const;

export const PROFILE_CERTIFICATE_CONTOURS: ReadonlyArray<{
  id: PreparationContour;
  shortLabel: string;
  fullLabel: string;
}> = [
  {
    id: 'contour_b',
    shortLabel: 'Контур Б · ДПО ВВГУ 250 ч',
    fullLabel: 'Контур Б — первичная аттестация и ДПО (ВВГУ 250 ч)',
  },
  {
    id: 'contour_a',
    shortLabel: 'Контур А · подтверждение ФСТР',
    fullLabel: 'Контур А — подтверждение квалификации (РЦА / ФСТР)',
  },
];

export interface ProfileCertificateStageRow {
  stepNumber: string;
  title: string;
  completedCount: number;
  totalCount: number;
  percent: number;
  status: 'completed' | 'in_progress' | 'pending';
  statusLabel: string;
  outputLabel: string;
}

export interface ProfileCertificateBuildInput {
  user: SessionUser;
  summary: UserAttestationSummary;
  inquiries?: InquiryRecord[];
  track?: string;
  complexityCategory?: string;
  contour?: PreparationContour;
  examDateIso?: string;
  protocolNote?: string;
  now?: Date;
}

export interface ProfileAttestationCertificateData {
  certificateNumber: string;
  verificationCode: string;
  issuedAtIso: string;
  issuedAtFormatted: string;
  validUntilIso: string;
  validUntilFormatted: string;
  holderName: string;
  holderEmail: string;
  roleLabel: string;
  region: string;
  organisation: string;
  trackLabel: string;
  complexityCategory: string;
  contourId: PreparationContour;
  contourLabel: string;
  examDateIso: string;
  examDateLabel: string;
  protocolNote: string;
  isFullyCompleted: boolean;
  qualificationStatusLabel: string;
  percent: number;
  completedStages: number;
  totalStages: number;
  completedTasks: number;
  totalTasks: number;
  stages: ProfileCertificateStageRow[];
}

export interface GeneratedProfileCertificateResult {
  fileName: string;
  data: ProfileAttestationCertificateData;
  previewDataUrl: string;
  pdfBlobUrl: string;
}

export function buildProfileCertificateNumber(
  userId: string,
  track: string,
  now: Date
): string {
  const year = now.getUTCFullYear();
  const num = String(10000 + (deterministicHash(`${userId}:${track}`) % 90000)).padStart(
    5,
    '0'
  );
  return `РЦА-ДФО-${year}-${num}`;
}

export function buildVerificationCode(
  userId: string,
  certificateNumber: string,
  examDateIso: string
): string {
  const code = deterministicHash(`${userId}|${certificateNumber}|${examDateIso}`)
    .toString(36)
    .toUpperCase()
    .padStart(6, '0')
    .slice(0, 8);
  return `RCA-${code}`;
}

function addYearsIso(isoDate: string, years: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function resolveDefaultTrack(
  inquiries: InquiryRecord[] = []
): string {
  const approvedOrLatest =
    inquiries.find((i) => i.status === 'approved') ?? inquiries[0] ?? null;
  return approvedOrLatest?.track?.trim() || PROFILE_CERTIFICATE_TRACKS[0];
}

export function resolveDefaultExamDateIso(
  inquiries: InquiryRecord[] = [],
  selectedExamDate?: string,
  now = new Date()
): string {
  if (selectedExamDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedExamDate)) {
    return selectedExamDate;
  }
  const approvedOrLatest =
    inquiries.find((i) => i.status === 'approved') ?? inquiries[0] ?? null;
  if (
    approvedOrLatest?.sessionDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(approvedOrLatest.sessionDate)
  ) {
    return approvedOrLatest.sessionDate;
  }
  return now.toISOString().slice(0, 10);
}

export function buildProfileAttestationCertificateData({
  user,
  summary,
  inquiries = [],
  track,
  complexityCategory,
  contour = 'contour_b',
  examDateIso,
  protocolNote,
  now = new Date(),
}: ProfileCertificateBuildInput): ProfileAttestationCertificateData {
  const issuedAtIso = now.toISOString().slice(0, 10);
  const validUntilIso = addYearsIso(issuedAtIso, 5);
  const resolvedTrack = track?.trim() || resolveDefaultTrack(inquiries);
  const resolvedCategory =
    complexityCategory?.trim() || PROFILE_CERTIFICATE_CATEGORIES[1];
  const resolvedExamIso = resolveDefaultExamDateIso(inquiries, examDateIso, now);
  const contourMeta =
    PROFILE_CERTIFICATE_CONTOURS.find((c) => c.id === contour) ??
    PROFILE_CERTIFICATE_CONTOURS[0];

  const certificateNumber = buildProfileCertificateNumber(user.id, resolvedTrack, now);
  const verificationCode = buildVerificationCode(
    user.id,
    certificateNumber,
    resolvedExamIso
  );

  const hasApprovedInquiry = inquiries.some((i) => i.status === 'approved');
  const isFullyCompleted =
    summary.percent >= 100 &&
    summary.stages.length > 0 &&
    summary.completedStages >= summary.stages.length;

  const qualificationStatusLabel = isFullyCompleted
    ? `Аттестация завершена на 100% (${summary.completedStages} из ${summary.stages.length} этапов)`
    : user.role === 'instructor' || hasApprovedInquiry
      ? `Допущен к аттестации / действующий профиль (${summary.percent}% этапов)`
      : `Подготовительный сертификат по профилю (${summary.percent}% этапов, ${summary.completedTasks}/${summary.totalTasks} шагов)`;

  const resolvedProtocolNote =
    protocolNote?.trim() ||
    (isFullyCompleted
      ? `Протокол комиссии РЦА «Русский Восток» · итоговое свидетельство`
      : `Сформировано по профилю личного кабинета · ${user.region || 'ДФО'}`);

  return {
    certificateNumber,
    verificationCode,
    issuedAtIso,
    issuedAtFormatted: formatRussianDate(issuedAtIso),
    validUntilIso,
    validUntilFormatted: formatRussianDate(validUntilIso),
    holderName: user.fullName.trim() || 'Инструктор-проводник ДФО',
    holderEmail: user.email,
    roleLabel: ROLE_LABELS[user.role],
    region: user.region?.trim() || 'Приморский край',
    organisation:
      user.organisation?.trim() || 'Независимый инструктор-проводник',
    trackLabel: resolvedTrack,
    complexityCategory: resolvedCategory,
    contourId: contourMeta.id,
    contourLabel: contourMeta.fullLabel,
    examDateIso: resolvedExamIso,
    examDateLabel: formatRussianDate(resolvedExamIso),
    protocolNote: resolvedProtocolNote,
    isFullyCompleted,
    qualificationStatusLabel,
    percent: summary.percent,
    completedStages: summary.completedStages,
    totalStages: summary.stages.length,
    completedTasks: summary.completedTasks,
    totalTasks: summary.totalTasks,
    stages: summary.stages.map((s) => ({
      stepNumber: s.stage.stepNumber,
      title: s.stage.title,
      completedCount: s.completedCount,
      totalCount: s.totalCount,
      percent: s.percent,
      status: s.status,
      statusLabel:
        s.status === 'completed'
          ? 'Завершён'
          : s.status === 'in_progress'
            ? 'В работе'
            : 'В плане',
      outputLabel: s.stage.outputLabel,
    })),
  };
}

function drawCurvedStampText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  clockwise: boolean
) {
  const chars = Array.from(text);
  if (chars.length === 0) return;
  const span = clockwise ? endAngle - startAngle : startAngle - endAngle;
  const step = chars.length > 1 ? span / (chars.length - 1) : 0;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  chars.forEach((ch, idx) => {
    const angle = clockwise ? startAngle + step * idx : startAngle - step * idx;
    ctx.save();
    ctx.translate(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
    ctx.rotate(clockwise ? angle + Math.PI / 2 : angle - Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });

  ctx.restore();
}

function drawOfficialSeal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.06);

  const ink = 'rgba(15, 118, 110, 0.9)';
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;

  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 42, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = 'bold 15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  drawCurvedStampText(
    ctx,
    'РЕГИОНАЛЬНЫЙ ЦЕНТР АТТЕСТАЦИИ',
    0,
    0,
    radius - 24,
    -Math.PI * 0.88,
    -Math.PI * 0.12,
    true
  );

  ctx.font = 'bold 14px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  drawCurvedStampText(
    ctx,
    'ВВГУ · ПРИМОРСКИЙ КРАЙ · ФСТР',
    0,
    0,
    radius - 24,
    Math.PI * 0.86,
    Math.PI * 0.14,
    false
  );

  ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', -(radius - 24), 0);
  ctx.fillText('★', radius - 24, 0);

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-40, -16);
  ctx.lineTo(-16, -42);
  ctx.lineTo(0, -24);
  ctx.lineTo(18, -48);
  ctx.lineTo(40, -16);
  ctx.stroke();

  ctx.font = 'bold 16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('«РУССКИЙ ВОСТОК»', 0, 8);
  ctx.font = 'bold 12px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('АТТЕСТАЦИОННАЯ', 0, 30);
  ctx.fillText('КОМИССИЯ', 0, 46);
  ctx.font = '11px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('г. Владивосток', 0, 68);

  ctx.restore();
}



function renderProfileCertificateCanvas(
  data: ProfileAttestationCertificateData
): HTMLCanvasElement {
  const W = 1654;
  const H = 2339;
  const marginX = 116;
  const contentW = W - marginX * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось инициализировать графический контекст для создания PDF.');
  }

  // Ivory paper background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Institutional frame
  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 6;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(64, 64, W - 128, H - 128);

  // Header band
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(64, 64, W - 128, 128);

  ctx.fillStyle = '#ccfbf1';
  ctx.font = 'bold 18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    'РЕГИОНАЛЬНЫЙ ЦЕНТР АТТЕСТАЦИИ ПРИМОРСКОГО КРАЯ · ВВГУ И ФСТР',
    marginX,
    112
  );

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 33px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('ЦЕНТР АТТЕСТАЦИИ «РУССКИЙ ВОСТОК»', marginX, 158);

  // Serial & dates row
  let y = 244;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(`Регистрационный № ${data.certificateNumber}`, marginX, y);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#334155';
  ctx.fillText(
    `Выдан: ${data.issuedAtFormatted} г. · Действует до: ${data.validUntilFormatted} г.`,
    W - marginX,
    y
  );
  ctx.textAlign = 'left';

  // Main title block
  y += 88;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 52px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('СЕРТИФИКАТ', W / 2, y);

  y += 46;
  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 24px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('О ПРОХОЖДЕНИИ АТТЕСТАЦИИ ИНСТРУКТОРА-ПРОВОДНИКА', W / 2, y);

  y += 34;
  ctx.fillStyle = '#475569';
  ctx.font = '19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    'Постановление Правительства РФ № 1003 (в редакции № 1893) · Дальневосточный федеральный округ',
    W / 2,
    y
  );

  // Holder name
  y += 64;
  ctx.fillStyle = '#64748b';
  ctx.font = '19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Настоящий сертификат оформлен на имя специалиста:', W / 2, y);

  y += 56;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 40px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(truncateTextToFit(ctx, data.holderName, contentW - 80), W / 2, y);

  y += 20;
  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 380, y);
  ctx.lineTo(W / 2 + 380, y);
  ctx.stroke();

  y += 40;
  ctx.fillStyle = '#334155';
  ctx.font = '20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  const summaryPhrase = data.isFullyCompleted
    ? 'успешно завершил(а) все этапы аттестации и подтвердил(а) квалификацию инструктора-проводника.'
    : 'проходит аттестацию инструктора-проводника в системе подготовки РЦА «Русский Восток».';
  ctx.fillText(summaryPhrase, W / 2, y);
  ctx.textAlign = 'left';

  // Profile & Attestation Metadata Table
  y += 44;
  const infoTop = y;
  const infoRows: [string, string][] = [
    ['Направление туризма:', data.trackLabel],
    ['Категория сложности:', data.complexityCategory],
    ['Контур подготовки:', data.contourLabel],
    ['Субъект ДФО:', data.region],
    ['Организация / профиль:', data.organisation],
    ['Статус и почта профиля:', `${data.roleLabel} · ${data.holderEmail}`],
    ['Дата аттестационной сессии:', data.examDateLabel],
    ['Протокол / основание:', data.protocolNote],
    ['Состояние аттестации:', data.qualificationStatusLabel],
  ];

  const rowH = 48;
  const infoH = infoRows.length * rowH + 24;
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.8;
  ctx.fillRect(marginX, infoTop, contentW, infoH);
  ctx.strokeRect(marginX, infoTop, contentW, infoH);

  let ry = infoTop + 42;
  infoRows.forEach(([label, value], idx) => {
    ctx.fillStyle = '#475569';
    ctx.font = '19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(label, marginX + 26, ry);

    const isLast = idx === infoRows.length - 1;
    ctx.fillStyle = isLast
      ? data.isFullyCompleted
        ? '#047857'
        : '#0f766e'
      : '#0f172a';
    ctx.font = 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const maxValW = contentW - 410;
    ctx.fillText(truncateTextToFit(ctx, value, maxValW), marginX + 370, ry);

    if (idx < infoRows.length - 1) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(marginX + 22, ry + 15);
      ctx.lineTo(W - marginX - 22, ry + 15);
      ctx.stroke();
    }
    ry += rowH;
  });

  // Stages Table
  y = infoTop + infoH + 46;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 23px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Прохождение этапов аттестации (данные личного кабинета)', marginX, y);

  y += 22;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(marginX, y, contentW, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Этап аттестации', marginX + 22, y + 28);
  ctx.fillText('Ожидаемый результат', marginX + 430, y + 28);
  ctx.fillText('Шаги', marginX + 1090, y + 28);
  ctx.fillText('Статус', marginX + 1230, y + 28);

  y += 44;
  data.stages.forEach((stage, idx) => {
    const trH = 58;
    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(marginX, y, contentW, trH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(marginX, y, contentW, trH);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(
      truncateTextToFit(ctx, `${stage.stepNumber}. ${stage.title}`, 390),
      marginX + 22,
      y + 36
    );

    ctx.fillStyle = '#334155';
    ctx.font = '17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(
      truncateTextToFit(ctx, stage.outputLabel, 630),
      marginX + 430,
      y + 36
    );

    ctx.fillStyle = '#0f172a';
    ctx.font = '19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(`${stage.completedCount}/${stage.totalCount}`, marginX + 1090, y + 36);

    ctx.fillStyle =
      stage.status === 'completed'
        ? '#047857'
        : stage.status === 'in_progress'
          ? '#b45309'
          : '#64748b';
    ctx.font = 'bold 18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(stage.statusLabel, marginX + 1230, y + 36);

    y += trH;
  });

  // Signatures, Seal & Verification Matrix
  const signBaseY = Math.max(y + 92, 1875);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Руководитель РЦА «Русский Восток»', marginX, signBaseY);
  ctx.fillStyle = '#475569';
  ctx.font = '17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('доцент кафедры туризма и ГРБ ВВГУ', marginX, signBaseY + 26);

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX + 420, signBaseY + 6);
  ctx.lineTo(marginX + 640, signBaseY + 6);
  ctx.stroke();

  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(marginX + 445, signBaseY - 2);
  ctx.bezierCurveTo(
    marginX + 485,
    signBaseY - 30,
    marginX + 505,
    signBaseY + 14,
    marginX + 545,
    signBaseY - 16
  );
  ctx.bezierCurveTo(
    marginX + 575,
    signBaseY - 38,
    marginX + 600,
    signBaseY + 4,
    marginX + 625,
    signBaseY - 12
  );
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Г. С. Саранча', marginX + 668, signBaseY);

  const sign2Y = signBaseY + 108;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Председатель аттестационной комиссии', marginX, sign2Y);
  ctx.fillStyle = '#475569';
  ctx.font = '17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('директор ИТКИ ВВГУ', marginX, sign2Y + 26);

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX + 420, sign2Y + 6);
  ctx.lineTo(marginX + 640, sign2Y + 6);
  ctx.stroke();

  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(marginX + 452, sign2Y - 4);
  ctx.bezierCurveTo(
    marginX + 495,
    sign2Y - 24,
    marginX + 520,
    sign2Y + 10,
    marginX + 565,
    sign2Y - 12
  );
  ctx.lineTo(marginX + 625, sign2Y - 22);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Г. А. Гомилевская', marginX + 668, sign2Y);

  drawOfficialSeal(ctx, W - marginX - 310, signBaseY + 54, 128);
  drawVerificationMatrix(
    ctx,
    W - marginX - 118,
    signBaseY - 10,
    108,
    `${data.certificateNumber}:${data.verificationCode}:${data.holderEmail}`,
    { framedPadding: 8 }
  );

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 14px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(data.verificationCode, W - marginX - 64, signBaseY + 122);
  ctx.textAlign = 'left';

  // Footer
  const footerY = H - 102;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX, footerY - 26);
  ctx.lineTo(W - marginX, footerY - 26);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `Документ сформирован в личном кабинете РЦА «Русский Восток» · № ${data.certificateNumber} · Код проверки ${data.verificationCode}`,
    marginX,
    footerY
  );

  return canvas;
}

export function generateProfileCertificatePdf(
  input: ProfileCertificateBuildInput,
  options: { autoDownload?: boolean } = {}
): GeneratedProfileCertificateResult {
  const data = buildProfileAttestationCertificateData(input);
  const canvas = renderProfileCertificateCanvas(data);
  const fileName = `Sertifikat_RCA_${sanitizeFileSlug(data.holderName, 'instructor', 40)}_${data.issuedAtIso}.pdf`;
  const { previewDataUrl, pdfBlobUrl } = exportCanvasAsA4PortraitPdf(canvas, fileName, options);

  return {
    fileName,
    data,
    previewDataUrl,
    pdfBlobUrl,
  };
}
