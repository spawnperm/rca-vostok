import { jsPDF } from 'jspdf';
import { ROLE_LABELS, type SessionUser } from './identityApi.ts';
import type { UserAttestationSummary } from '../components/AttestationProgressWidget.tsx';
import type { InquiryRecord } from '../components/social/MyInquiriesSection.tsx';
import { formatRussianDate } from './personalRoadmap.ts';

export interface FinalAttestationStageLine {
  stepNumber: string;
  title: string;
  completedCount: number;
  totalCount: number;
  outputLabel: string;
}

export interface FinalAttestationCertificateData {
  certificateNumber: string;
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
  examDateLabel: string;
  completedStages: number;
  totalStages: number;
  completedTasks: number;
  totalTasks: number;
  stages: FinalAttestationStageLine[];
}

export interface GeneratedFinalCertificateResult {
  fileName: string;
  data: FinalAttestationCertificateData;
  previewDataUrl: string;
  pdfBlobUrl: string;
}

export function isAttestationEligibleForCertificate(
  summary: Pick<UserAttestationSummary, 'percent' | 'completedStages' | 'stages'>
): boolean {
  return (
    summary.percent >= 100 &&
    summary.stages.length > 0 &&
    summary.completedStages >= summary.stages.length
  );
}

function buildCertificateNumber(userId: string, now: Date): string {
  const year = now.getUTCFullYear();
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 33 + userId.charCodeAt(i)) % 90000;
  }
  const num = String(10000 + hash).padStart(5, '0');
  return `РЦА-ДФО-${year}-${num}`;
}

function addYearsIso(isoDate: string, years: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function buildFinalAttestationCertificateData(
  user: SessionUser,
  summary: UserAttestationSummary,
  inquiries: InquiryRecord[] = [],
  examDateIso?: string,
  now = new Date()
): FinalAttestationCertificateData {
  if (!isAttestationEligibleForCertificate(summary)) {
    throw new Error(
      'Сертификат формируется только после завершения всех этапов аттестации (100%).'
    );
  }

  const issuedAtIso = now.toISOString().slice(0, 10);
  const validUntilIso = addYearsIso(issuedAtIso, 5);
  const latestApproved =
    inquiries.find((i) => i.status === 'approved') ?? inquiries[0] ?? null;

  const resolvedExamIso =
    examDateIso ||
    latestApproved?.sessionDate ||
    issuedAtIso;

  return {
    certificateNumber: buildCertificateNumber(user.id, now),
    issuedAtIso,
    issuedAtFormatted: formatRussianDate(issuedAtIso),
    validUntilIso,
    validUntilFormatted: formatRussianDate(validUntilIso),
    holderName: user.fullName,
    holderEmail: user.email,
    roleLabel: ROLE_LABELS[user.role],
    region: user.region || 'Приморский край',
    organisation: user.organisation?.trim() || 'Независимый инструктор-проводник',
    trackLabel:
      latestApproved?.track || 'Инструктор-проводник по туризму (пешеходный / водный профиль)',
    examDateLabel: formatRussianDate(resolvedExamIso),
    completedStages: summary.completedStages,
    totalStages: summary.stages.length,
    completedTasks: summary.completedTasks,
    totalTasks: summary.totalTasks,
    stages: summary.stages.map((s) => ({
      stepNumber: s.stage.stepNumber,
      title: s.stage.title,
      completedCount: s.completedCount,
      totalCount: s.totalCount,
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

function renderFinalCertificateCanvas(
  data: FinalAttestationCertificateData
): HTMLCanvasElement {
  const W = 1654;
  const H = 2339;
  const marginX = 120;
  const contentW = W - marginX * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось инициализировать графический контекст для формирования PDF.');
  }

  // Crisp ivory-white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Outer institutional frame
  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 6;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(64, 64, W - 128, H - 128);

  // Top header band
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(64, 64, W - 128, 128);

  ctx.fillStyle = '#ccfbf1';
  ctx.font = 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('РЕГИОНАЛЬНЫЙ ЦЕНТР АТТЕСТАЦИИ ПРИМОРСКОГО КРАЯ · ВВГУ И ФСТР', marginX, 114);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('ЦЕНТР АТТЕСТАЦИИ «РУССКИЙ ВОСТОК»', marginX, 158);

  // Certificate No & Validity Row
  let y = 248;
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 21px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(`Регистрационный № ${data.certificateNumber}`, marginX, y);

  ctx.textAlign = 'right';
  ctx.fillText(
    `Дата выдачи: ${data.issuedAtFormatted} г. · Действует до: ${data.validUntilFormatted} г.`,
    W - marginX,
    y
  );
  ctx.textAlign = 'left';

  // Main Certificate Title
  y += 96;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 52px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('СЕРТИФИКАТ', W / 2, y);

  y += 46;
  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 25px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('О ПРОХОЖДЕНИИ АТТЕСТАЦИИ ИНСТРУКТОРА-ПРОВОДНИКА', W / 2, y);

  y += 38;
  ctx.fillStyle = '#475569';
  ctx.font = '20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    'Постановление Правительства РФ № 1003 (в редакции № 1893) · Единый федеральный реестр',
    W / 2,
    y
  );

  // Holder Name Highlight
  y += 72;
  ctx.fillStyle = '#64748b';
  ctx.font = '20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Настоящий документ подтверждает, что', W / 2, y);

  y += 58;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 42px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(data.holderName, W / 2, y);

  y += 22;
  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 360, y);
  ctx.lineTo(W / 2 + 360, y);
  ctx.stroke();

  y += 42;
  ctx.fillStyle = '#334155';
  ctx.font = '22px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    'успешно завершил(а) все этапы аттестации и подтвердил(а) профессиональную квалификацию.',
    W / 2,
    y
  );
  ctx.textAlign = 'left';

  // Details Card
  y += 52;
  const infoTop = y;
  const infoRows: [string, string][] = [
    ['Направление аттестации:', data.trackLabel],
    ['Субъект ДФО:', data.region],
    ['Организация / профиль:', data.organisation],
    ['Электронная почта:', data.holderEmail],
    ['Дата аттестационной сессии:', data.examDateLabel],
    [
      'Итоговый результат:',
      `100% · ${data.completedStages} из ${data.totalStages} этапов (${data.completedTasks}/${data.totalTasks} шагов пройдено)`,
    ],
  ];

  const rowH = 50;
  const infoH = infoRows.length * rowH + 28;
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.8;
  ctx.fillRect(marginX, infoTop, contentW, infoH);
  ctx.strokeRect(marginX, infoTop, contentW, infoH);

  let ry = infoTop + 44;
  infoRows.forEach(([label, value], idx) => {
    ctx.fillStyle = '#475569';
    ctx.font = '20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(label, marginX + 28, ry);

    ctx.fillStyle = idx === infoRows.length - 1 ? '#047857' : '#0f172a';
    ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(value, marginX + 380, ry);

    if (idx < infoRows.length - 1) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(marginX + 24, ry + 16);
      ctx.lineTo(W - marginX - 24, ry + 16);
      ctx.stroke();
    }
    ry += rowH;
  });

  // Completed Stages Table
  y = infoTop + infoH + 56;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 25px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Результаты прохождения этапов аттестации', marginX, y);

  y += 26;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(marginX, y, contentW, 46);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Этап', marginX + 22, y + 30);
  ctx.fillText('Итоговый результат этапа', marginX + 430, y + 30);
  ctx.fillText('Шаги', marginX + 1090, y + 30);
  ctx.fillText('Статус', marginX + 1230, y + 30);

  y += 46;
  data.stages.forEach((stage, idx) => {
    const trH = 64;
    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(marginX, y, contentW, trH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(marginX, y, contentW, trH);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(`${stage.stepNumber}. ${stage.title}`, marginX + 22, y + 39);

    ctx.fillStyle = '#334155';
    ctx.font = '18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(stage.outputLabel.slice(0, 56), marginX + 430, y + 39);

    ctx.fillStyle = '#0f172a';
    ctx.font = '20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(`${stage.completedCount}/${stage.totalCount}`, marginX + 1090, y + 39);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText('Завершён', marginX + 1230, y + 39);

    y += trH;
  });

  // Signatures & Official Seal
  const signBaseY = 1860;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Руководитель РЦА «Русский Восток»', marginX, signBaseY);
  ctx.fillStyle = '#475569';
  ctx.font = '18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('доцент кафедры туризма и ГРБ ВВГУ', marginX, signBaseY + 28);

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX + 430, signBaseY + 6);
  ctx.lineTo(marginX + 660, signBaseY + 6);
  ctx.stroke();

  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(marginX + 455, signBaseY - 2);
  ctx.bezierCurveTo(
    marginX + 495,
    signBaseY - 32,
    marginX + 515,
    signBaseY + 14,
    marginX + 555,
    signBaseY - 18
  );
  ctx.bezierCurveTo(
    marginX + 585,
    signBaseY - 40,
    marginX + 610,
    signBaseY + 4,
    marginX + 640,
    signBaseY - 12
  );
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Г. С. Саранча', marginX + 690, signBaseY);

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
  ctx.bezierCurveTo(
    marginX + 505,
    sign2Y - 26,
    marginX + 530,
    sign2Y + 10,
    marginX + 575,
    sign2Y - 14
  );
  ctx.lineTo(marginX + 635, sign2Y - 24);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Г. А. Гомилевская', marginX + 690, sign2Y);

  drawOfficialSeal(ctx, W - marginX - 180, signBaseY + 55, 138);

  // Footer
  const footerY = H - 104;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX, footerY - 28);
  ctx.lineTo(W - marginX, footerY - 28);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `Сертификат сформирован в личном кабинете РЦА «Русский Восток» · № ${data.certificateNumber} · Срок действия: 5 лет`,
    marginX,
    footerY
  );

  return canvas;
}

function sanitizeFileSlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'guide'
  );
}

export function generateAttestationFinalCertificatePdf(
  user: SessionUser,
  summary: UserAttestationSummary,
  inquiries: InquiryRecord[] = [],
  examDateIso?: string
): GeneratedFinalCertificateResult {
  const data = buildFinalAttestationCertificateData(user, summary, inquiries, examDateIso);
  const canvas = renderFinalCertificateCanvas(data);
  const previewDataUrl = canvas.toDataURL('image/png');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pdf.addImage(previewDataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

  const fileName = `Sertifikat_Attestacii_RCA_${sanitizeFileSlug(user.fullName)}_${data.issuedAtIso}.pdf`;
  const pdfBlob = pdf.output('blob');
  const pdfBlobUrl = URL.createObjectURL(pdfBlob);

  pdf.save(fileName);

  return {
    fileName,
    data,
    previewDataUrl,
    pdfBlobUrl,
  };
}
