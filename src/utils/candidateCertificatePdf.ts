import { jsPDF } from 'jspdf';
import { ROLE_LABELS, type SessionUser } from './identityApi.ts';
import type { UserAttestationSummary } from '../components/AttestationProgressWidget.tsx';
import type { InquiryRecord } from '../components/social/MyInquiriesSection.tsx';
import { formatRussianDate } from './personalRoadmap.ts';

export interface CandidateCertificateStageRow {
  stepNumber: string;
  title: string;
  completedCount: number;
  totalCount: number;
  percent: number;
  statusLabel: string;
}

export interface CandidateCertificateData {
  docNumber: string;
  issuedAtIso: string;
  issuedAtFormatted: string;
  candidateName: string;
  candidateEmail: string;
  roleLabel: string;
  region: string;
  organisation: string;
  trackLabel: string;
  examDateLabel: string;
  overallPercent: number;
  completedStages: number;
  totalStages: number;
  completedTasks: number;
  totalTasks: number;
  activeStageLabel: string;
  statusConclusion: string;
  stages: CandidateCertificateStageRow[];
}

export interface GeneratedPdfResult {
  fileName: string;
  data: CandidateCertificateData;
  previewDataUrl: string;
  pdfBlobUrl: string;
}

function buildDocNumber(userId: string, now: Date): string {
  const year = now.getUTCFullYear();
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) % 9000;
  }
  const num = String(1000 + hash).padStart(4, '0');
  const dayCode = String(now.getUTCMonth() + 1).padStart(2, '0') + String(now.getUTCDate()).padStart(2, '0');
  return `РЦА-${year}/СК-${num}-${dayCode}`;
}

export function buildCandidateCertificateData(
  user: SessionUser,
  summary: UserAttestationSummary,
  inquiries: InquiryRecord[] = [],
  examDateIso?: string,
  now = new Date()
): CandidateCertificateData {
  const issuedAtIso = now.toISOString().slice(0, 10);
  const latestInquiry = inquiries[0] ?? null;

  const stages: CandidateCertificateStageRow[] = summary.stages.map((s) => ({
    stepNumber: s.stage.stepNumber,
    title: s.stage.title,
    completedCount: s.completedCount,
    totalCount: s.totalCount,
    percent: s.percent,
    statusLabel:
      s.status === 'completed'
        ? 'Завершён'
        : s.status === 'in_progress'
          ? 'В работе'
          : 'Ожидает',
  }));

  const activeStageLabel =
    summary.percent === 100
      ? 'Аттестация завершена полностью'
      : `Этап ${summary.activeStage.stepNumber}: ${summary.activeStage.title}`;

  let statusConclusion: string;
  if (summary.percent === 100) {
    statusConclusion =
      'Соискатель выполнил все этапы программы подготовки и аттестации инструктора-проводника, соответствует требованиям ПП РФ № 1003 и № 1893 для включения в Единый федеральный реестр сроком на 5 лет.';
  } else if (summary.percent >= 50) {
    statusConclusion =
      'Соискатель подтвердил базовый этап допуска и продолжает подготовку к аттестационной сессии на базе ВВГУ и РЦА «Русский Восток» в соответствии с требованиями ПП РФ № 1003 и № 1893.';
  } else {
    statusConclusion =
      'Соискатель зарегистрирован в личном кабинете РЦА «Русский Восток» и проходит начальный этап формирования пакета документов и выбора маршрутной программы подготовки.';
  }

  return {
    docNumber: buildDocNumber(user.id, now),
    issuedAtIso,
    issuedAtFormatted: formatRussianDate(issuedAtIso),
    candidateName: user.fullName,
    candidateEmail: user.email,
    roleLabel: ROLE_LABELS[user.role],
    region: user.region || 'Приморский край',
    organisation: user.organisation?.trim() || 'Индивидуальное соискание',
    trackLabel: latestInquiry?.track || 'Инструктор-проводник (пешеходный / водный профиль)',
    examDateLabel: examDateIso ? formatRussianDate(examDateIso) : 'Не выбрана (уточняется по графику 2027 г.)',
    overallPercent: summary.percent,
    completedStages: summary.completedStages,
    totalStages: summary.stages.length,
    completedTasks: summary.completedTasks,
    totalTasks: summary.totalTasks,
    activeStageLabel,
    statusConclusion,
    stages,
  };
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
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

/** Draws the official circular rubber stamp of RCA «Русский Восток». */
function drawRcaStamp(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.09);

  const inkColor = 'rgba(15, 92, 128, 0.88)';
  ctx.strokeStyle = inkColor;
  ctx.fillStyle = inkColor;

  // Outer thick ring
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Outer fine ring
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 8, 0, Math.PI * 2);
  ctx.stroke();

  // Inner ring
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 42, 0, Math.PI * 2);
  ctx.stroke();

  // Curved perimeter labels
  ctx.font = 'bold 16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
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

  // Decorative stars separating top and bottom arcs
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', -(radius - 24), 0);
  ctx.fillText('★', radius - 24, 0);

  // Stylized mountain ridge emblem in upper inner half
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-42, -16);
  ctx.lineTo(-18, -42);
  ctx.lineTo(-2, -25);
  ctx.lineTo(18, -48);
  ctx.lineTo(42, -16);
  ctx.stroke();

  // Central stamp text
  ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('«РУССКИЙ ВОСТОК»', 0, 8);

  ctx.font = 'bold 12px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('ДЛЯ СПРАВОК', 0, 30);
  ctx.fillText('И ПРОТОКОЛОВ', 0, 46);

  ctx.font = '11px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('г. Владивосток', 0, 68);

  ctx.restore();
}

function renderCertificateCanvas(data: CandidateCertificateData): HTMLCanvasElement {
  // 200 DPI A4 portrait
  const W = 1654;
  const H = 2339;
  const marginX = 128;
  const contentW = W - marginX * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось инициализировать графический контекст для формирования PDF.');
  }

  // Crisp paper background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Subtle top institutional bar
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(0, 0, W, 18);

  // Institutional header
  let y = 104;
  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('РЕГИОНАЛЬНЫЙ ЦЕНТР АТТЕСТАЦИИ ПРИМОРСКОГО КРАЯ', marginX, y);

  y += 38;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 34px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('«РУССКИЙ ВОСТОК»', marginX, y);

  y += 32;
  ctx.fillStyle = '#475569';
  ctx.font = '20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    'База: Институт туризма и креативных индустрий ВВГУ · Федерация спортивного туризма России',
    marginX,
    y
  );

  y += 26;
  ctx.fillStyle = '#64748b';
  ctx.font = '18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    '690014, г. Владивосток, ул. Гоголя, д. 41 · тел. +7 (991) 809 08 70 · russian_east@bk.ru',
    marginX,
    y
  );

  y += 28;
  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(marginX, y);
  ctx.lineTo(W - marginX, y);
  ctx.stroke();

  // Reg number & date row
  y += 42;
  ctx.fillStyle = '#334155';
  ctx.font = '20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(`Исх. № ${data.docNumber}`, marginX, y);

  ctx.textAlign = 'right';
  ctx.fillText(`Дата выдачи: ${data.issuedAtFormatted} г.`, W - marginX, y);
  ctx.textAlign = 'left';

  // Document title
  y += 88;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 40px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('СПРАВКА О СТАТУСЕ КАНДИДАТА', W / 2, y);

  y += 38;
  ctx.fillStyle = '#475569';
  ctx.font = '22px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('на прохождение аттестации инструкторов-проводников (ПП РФ № 1003, № 1893)', W / 2, y);
  ctx.textAlign = 'left';

  // Candidate summary box
  y += 52;
  const profileBoxTop = y;
  const profileRows: [string, string][] = [
    ['Соискатель (ФИО):', data.candidateName],
    ['Электронная почта:', data.candidateEmail],
    ['Статус учётной записи:', data.roleLabel],
    ['Субъект ДФО:', data.region],
    ['Организация / профиль:', data.organisation],
    ['Направление подготовки:', data.trackLabel],
    ['Плановая дата экзамена:', data.examDateLabel],
  ];

  const rowHeight = 46;
  const boxHeight = profileRows.length * rowHeight + 36;
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.8;
  ctx.fillRect(marginX, profileBoxTop, contentW, boxHeight);
  ctx.strokeRect(marginX, profileBoxTop, contentW, boxHeight);

  let rowY = profileBoxTop + 44;
  profileRows.forEach(([label, value], idx) => {
    ctx.fillStyle = '#475569';
    ctx.font = '20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(label, marginX + 28, rowY);

    ctx.fillStyle = '#0f172a';
    ctx.font = idx === 0
      ? 'bold 24px "DejaVu Sans", "Liberation Sans", Arial, sans-serif'
      : 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(value, marginX + 360, rowY);

    if (idx < profileRows.length - 1) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(marginX + 24, rowY + 14);
      ctx.lineTo(W - marginX - 24, rowY + 14);
      ctx.stroke();
    }
    rowY += rowHeight;
  });

  // Progress bar section directly synced with Account progress bar
  y = profileBoxTop + boxHeight + 56;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Показатели прохождения аттестационного маршрута', marginX, y);

  y += 38;
  ctx.fillStyle = '#334155';
  ctx.font = '21px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(data.activeStageLabel, marginX, y);

  ctx.textAlign = 'right';
  ctx.fillStyle = data.overallPercent === 100 ? '#047857' : '#0f766e';
  ctx.font = 'bold 30px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `${data.overallPercent}% (${data.completedTasks} из ${data.totalTasks} шагов · ${data.completedStages}/${data.totalStages} этапов)`,
    W - marginX,
    y
  );
  ctx.textAlign = 'left';

  // Progress bar track + fill
  y += 22;
  const barW = contentW;
  const barH = 26;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(marginX, y, barW, barH);
  const fillW = Math.round((barW * Math.max(0, Math.min(100, data.overallPercent))) / 100);
  ctx.fillStyle = data.overallPercent === 100 ? '#059669' : '#0f766e';
  ctx.fillRect(marginX, y, fillW, barH);

  // Quarter ticks
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  [0.25, 0.5, 0.75].forEach((ratio) => {
    const tx = marginX + Math.round(barW * ratio);
    ctx.beginPath();
    ctx.moveTo(tx, y);
    ctx.lineTo(tx, y + barH);
    ctx.stroke();
  });

  // 4-stage table
  y += 66;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(marginX, y, contentW, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Этап аттестации', marginX + 20, y + 29);
  ctx.fillText('Шаги', marginX + 760, y + 29);
  ctx.fillText('Готовность', marginX + 940, y + 29);
  ctx.fillText('Статус этапа', marginX + 1140, y + 29);

  y += 44;
  data.stages.forEach((stageRow, idx) => {
    const trH = 54;
    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(marginX, y, contentW, trH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(marginX, y, contentW, trH);

    ctx.fillStyle = '#0f172a';
    ctx.font = '20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(`Этап ${stageRow.stepNumber}. ${stageRow.title}`, marginX + 20, y + 34);
    ctx.fillText(`${stageRow.completedCount} / ${stageRow.totalCount}`, marginX + 760, y + 34);

    ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(`${stageRow.percent}%`, marginX + 940, y + 34);

    ctx.fillStyle =
      stageRow.statusLabel === 'Завершён'
        ? '#047857'
        : stageRow.statusLabel === 'В работе'
          ? '#b45309'
          : '#475569';
    ctx.fillText(stageRow.statusLabel, marginX + 1140, y + 34);

    y += trH;
  });

  // Official conclusion prose
  y += 56;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 23px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Заключение о текущем статусе кандидата:', marginX, y);

  y += 38;
  ctx.fillStyle = '#334155';
  ctx.font = '21px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  const wrapped = wrapLines(ctx, data.statusConclusion, contentW);
  wrapped.forEach((line) => {
    ctx.fillText(line, marginX, y);
    y += 33;
  });

  // Signatures + official stamp section near bottom
  const signBaseY = 1915;

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Руководитель РЦА «Русский Восток»', marginX, signBaseY);
  ctx.fillStyle = '#475569';
  ctx.font = '18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('доцент кафедры туризма и ГРБ ВВГУ', marginX, signBaseY + 28);

  // Signature line + pen stroke
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX + 430, signBaseY + 6);
  ctx.lineTo(marginX + 660, signBaseY + 6);
  ctx.stroke();

  // Signature ink flourish
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(marginX + 455, signBaseY - 2);
  ctx.bezierCurveTo(marginX + 495, signBaseY - 32, marginX + 515, signBaseY + 14, marginX + 555, signBaseY - 18);
  ctx.bezierCurveTo(marginX + 585, signBaseY - 40, marginX + 610, signBaseY + 4, marginX + 640, signBaseY - 12);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Г. С. Саранча', marginX + 690, signBaseY);

  // Second signatory
  const sign2Y = signBaseY + 115;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Председатель аттестационной комиссии', marginX, sign2Y);
  ctx.fillStyle = '#475569';
  ctx.font = '18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('директор ИТКИ ВВГУ', marginX, sign2Y + 28);

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX + 430, sign2Y + 6);
  ctx.lineTo(marginX + 660, sign2Y + 6);
  ctx.stroke();

  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(marginX + 462, sign2Y - 4);
  ctx.bezierCurveTo(marginX + 505, sign2Y - 26, marginX + 530, sign2Y + 10, marginX + 575, sign2Y - 14);
  ctx.lineTo(marginX + 635, sign2Y - 24);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Г. А. Гомилевская', marginX + 690, sign2Y);

  // Draw official RCA ink stamp slightly overlapping signature area on the right
  drawRcaStamp(ctx, W - marginX - 180, signBaseY + 55, 138);

  // Footer note
  const footerY = H - 92;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX, footerY - 28);
  ctx.lineTo(W - marginX, footerY - 28);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `Электронный документ сформирован в личном кабинете РЦА «Русский Восток» · Рег. ${data.docNumber} · https://rca-vostok.ru`,
    marginX,
    footerY
  );

  return canvas;
}

function sanitizeFileSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'candidate';
}

export function generateCandidateCertificatePdf(
  user: SessionUser,
  summary: UserAttestationSummary,
  inquiries: InquiryRecord[] = [],
  examDateIso?: string
): GeneratedPdfResult {
  const data = buildCandidateCertificateData(user, summary, inquiries, examDateIso);
  const canvas = renderCertificateCanvas(data);
  const previewDataUrl = canvas.toDataURL('image/png');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pdf.addImage(previewDataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

  const fileName = `Spravka_RCA_${sanitizeFileSlug(user.fullName)}_${data.issuedAtIso}.pdf`;
  const pdfBlob = pdf.output('blob');
  const pdfBlobUrl = URL.createObjectURL(pdfBlob);

  // Trigger download without window.open
  pdf.save(fileName);

  return {
    fileName,
    data,
    previewDataUrl,
    pdfBlobUrl,
  };
}
