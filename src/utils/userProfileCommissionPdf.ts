import type { ExperienceLogEntry } from '../domain/experience/ExperienceEntry.ts';
import { computeJournalMetrics } from '../domain/experience/ExperienceAnalyticsService.ts';
import { ROLE_LABELS, type SessionUser } from './identityApi.ts';
import {
  deterministicHash,
  drawRoundedRect,
  drawVerificationMatrix,
  exportCanvasAsA4PortraitPdf,
  loadImageElement,
  sanitizeFileSlug,
  wrapLines,
} from './pdfCanvasHelpers.ts';
import { formatRussianDate } from './personalRoadmap.ts';
import type { SelfCheckEvaluation } from './qualificationSelfCheck.ts';
import type { UserQualificationProfile } from './updatesFeed.ts';

export interface UserProfileCommissionDossierInput {
  user: SessionUser;
  qualification: UserQualificationProfile;
  attestationPercent: number;
  selfCheck?: SelfCheckEvaluation | null;
  journalEntries?: readonly ExperienceLogEntry[];
  now?: Date;
}

export interface UserProfileCommissionDossierData {
  dossierNumber: string;
  verificationCode: string;
  issuedAtIso: string;
  issuedAtFormatted: string;
  fullName: string;
  roleLabel: string;
  qualificationLabel: string;
  complexityRange: string;
  qualificationDescription: string;
  qualificationReasons: string[];
  email: string;
  phone: string;
  telegram: string;
  region: string;
  organisation: string;
  attestationExpiresFormatted: string;
  attestationPercent: number;
  selfCheckReadinessPercent: number;
  selfCheckTrackLabel: string;
  tripsCount: number;
  participantsTotal: number;
  maxComplexity: string;
  totalDistanceKm: number;
  recentTrips: Array<{
    date: string;
    routeTitle: string;
    regionName: string;
    complexity: string;
    participantsCount: number;
  }>;
  avatarUrl: string;
}

export interface GeneratedUserProfilePdfResult {
  fileName: string;
  data: UserProfileCommissionDossierData;
  previewDataUrl: string;
  pdfBlobUrl: string;
}

export function buildUserProfileCommissionDossierData({
  user,
  qualification,
  attestationPercent,
  selfCheck = null,
  journalEntries = [],
  now = new Date(),
}: UserProfileCommissionDossierInput): UserProfileCommissionDossierData {
  const issuedAtIso = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  const numPart = String(
    10000 + (deterministicHash(`${user.id}:${issuedAtIso}`) % 90000)
  ).padStart(5, '0');
  const dossierNumber = `АНК-РЦА-${year}-${numPart}`;
  const verificationCode = `PROF-${deterministicHash(`${user.id}|${dossierNumber}|${user.email}`)
    .toString(36)
    .toUpperCase()
    .padStart(6, '0')
    .slice(0, 6)}`;

  const metrics = computeJournalMetrics(journalEntries);
  const trackMap = {
    hiking: 'Пешеходный туризм',
    water: 'Водный туризм и сплавы',
    expedition: 'Горный / экспедиционный туризм',
  } as const;

  return {
    dossierNumber,
    verificationCode,
    issuedAtIso,
    issuedAtFormatted: formatRussianDate(issuedAtIso),
    fullName: user.fullName,
    roleLabel: ROLE_LABELS[user.role] ?? user.role,
    qualificationLabel: qualification.label,
    complexityRange: qualification.complexityRange,
    qualificationDescription: qualification.description,
    qualificationReasons: [...qualification.reasons],
    email: user.email,
    phone: user.phone?.trim() || 'Не указан',
    telegram: user.telegram?.trim() || 'Не указан',
    region: user.region,
    organisation: user.organisation?.trim() || 'Не указана',
    attestationExpiresFormatted: user.attestationExpiresAt
      ? formatRussianDate(user.attestationExpiresAt)
      : 'Первичная подача / не задан',
    attestationPercent: Math.max(0, Math.min(100, Math.round(attestationPercent))),
    selfCheckReadinessPercent: selfCheck?.readinessPercent ?? 0,
    selfCheckTrackLabel: selfCheck ? trackMap[selfCheck.track] : 'Не выбран',
    tripsCount: metrics.totalTrips,
    participantsTotal: metrics.totalParticipants,
    maxComplexity: metrics.maxComplexity,
    totalDistanceKm: metrics.totalDistanceKm,
    recentTrips: journalEntries.slice(0, 5).map((e) => ({
      date: formatRussianDate(e.date),
      routeTitle: e.routeTitle,
      regionName: e.regionName,
      complexity: e.complexity,
      participantsCount: e.participantsCount,
    })),
    avatarUrl: user.avatarUrl?.trim() || '',
  };
}



export async function generateUserProfileCommissionPdf(
  input: UserProfileCommissionDossierInput,
  options: { autoDownload?: boolean } = {}
): Promise<GeneratedUserProfilePdfResult> {
  const data = buildUserProfileCommissionDossierData(input);
  const avatarImg = await loadImageElement(data.avatarUrl);

  const W = 1240;
  const H = 1754;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Браузер не поддерживает Canvas 2D для формирования PDF.');
  }

  // White A4 backdrop + subtle official border
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  // Header band
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(36, 36, W - 72, 178);

  const marginX = 82;
  ctx.fillStyle = '#5eead4';
  ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('РЕГИОНАЛЬНЫЙ ЦЕНТР АТТЕСТАЦИИ «РУССКИЙ ВОСТОК» · ВВГУ И ФСТР', marginX, 92);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('УЧЁТНАЯ КАРТА УЧАСТНИКА ДЛЯ АТТЕСТАЦИОННОЙ КОМИССИИ', marginX, 142);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `Исходящий № ${data.dossierNumber} · Сформировано ${data.issuedAtFormatted}`,
    marginX,
    182
  );

  // Top Identity & Photo Card
  let curY = 250;
  const cardW = W - marginX * 2;
  ctx.fillStyle = '#f8fafc';
  drawRoundedRect(ctx, marginX, curY, cardW, 240, 14);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Portrait Box (180x180)
  const photoX = marginX + 28;
  const photoY = curY + 30;
  const photoSize = 180;
  ctx.save();
  drawRoundedRect(ctx, photoX, photoY, photoSize, photoSize, 14);
  ctx.clip();
  if (avatarImg) {
    const scale = Math.max(photoSize / avatarImg.width, photoSize / avatarImg.height);
    const dw = avatarImg.width * scale;
    const dh = avatarImg.height * scale;
    ctx.drawImage(
      avatarImg,
      photoX + (photoSize - dw) / 2,
      photoY + (photoSize - dh) / 2,
      dw,
      dh
    );
  } else {
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(photoX, photoY, photoSize, photoSize);
    const initials =
      data.fullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('') || 'РЦА';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(initials, photoX + photoSize / 2, photoY + 110);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, photoX, photoY, photoSize, photoSize, 14);
  ctx.stroke();

  // Name & Qualification Right of Photo
  const infoX = photoX + photoSize + 34;
  const infoMaxW = cardW - (photoSize + 92);

  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(`СТАТУС В СИСТЕМЕ: ${data.roleLabel.toUpperCase()}`, infoX, curY + 56);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 32px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  const nameLines = wrapLines(ctx, data.fullName, infoMaxW);
  nameLines.slice(0, 2).forEach((ln, idx) => {
    ctx.fillText(ln, infoX, curY + 100 + idx * 38);
  });

  const qualY = curY + (nameLines.length > 1 ? 180 : 154);
  ctx.fillStyle = '#115e59';
  ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(`Квалификация: ${data.qualificationLabel}`, infoX, qualY);

  ctx.fillStyle = '#475569';
  ctx.font = '17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `Категорийный диапазон: ${data.complexityRange} · Прогресс маршрута: ${data.attestationPercent}%`,
    infoX,
    qualY + 32
  );

  // Section 1: Contact Details & Registration
  curY += 276;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('1. КОНТАКТНЫЕ ДАННЫЕ И РЕГИОНАЛЬНАЯ ПРИНАДЛЕЖНОСТЬ', marginX, curY);
  curY += 16;

  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(marginX, curY);
  ctx.lineTo(marginX + cardW, curY);
  ctx.stroke();
  curY += 28;

  const contactRows: Array<[string, string]> = [
    ['Контактный телефон', data.phone],
    ['Telegram для связи', data.telegram],
    ['Электронная почта (логин)', data.email],
    ['Субъект ДФО', data.region],
    ['Организация / турклуб', data.organisation],
    ['Срок текущей аттестации', data.attestationExpiresFormatted],
  ];

  contactRows.forEach(([label, val], idx) => {
    const rowY = curY + idx * 46;
    ctx.fillStyle = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
    ctx.fillRect(marginX, rowY - 28, cardW, 44);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(marginX, rowY - 28, cardW, 44);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(label, marginX + 18, rowY);

    ctx.fillStyle = '#0f172a';
    ctx.font = '18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(val, marginX + 340, rowY);
  });

  curY += contactRows.length * 46 + 26;

  // Section 2: Qualification Profile & Grounds
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('2. ОЦЕНКА КВАЛИФИКАЦИИ И ПРОФИЛЬ ОПЫТА', marginX, curY);
  curY += 16;

  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(marginX, curY);
  ctx.lineTo(marginX + cardW, curY);
  ctx.stroke();
  curY += 28;

  const summaryBoxH = 185;
  ctx.fillStyle = '#f0fdfa';
  drawRoundedRect(ctx, marginX, curY - 12, cardW, summaryBoxH, 12);
  ctx.fill();
  ctx.strokeStyle = '#99f6e4';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#134e4a';
  ctx.font = '17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  const descLines = wrapLines(ctx, data.qualificationDescription, cardW - 44);
  descLines.slice(0, 2).forEach((ln, idx) => {
    ctx.fillText(ln, marginX + 22, curY + 20 + idx * 25);
  });

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `Самопроверка (${data.selfCheckTrackLabel}): ${data.selfCheckReadinessPercent}%   ·   Походов в журнале: ${data.tripsCount} (макс. ${data.maxComplexity}, участников: ${data.participantsTotal}, пройдено: ${data.totalDistanceKm} км)`,
    marginX + 22,
    curY + 86
  );

  ctx.fillStyle = '#334155';
  ctx.font = '16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  const reasonsLine = `Основания уровня: ${data.qualificationReasons.join('; ')}`;
  wrapLines(ctx, reasonsLine, cardW - 44)
    .slice(0, 2)
    .forEach((ln, idx) => {
      ctx.fillText(ln, marginX + 22, curY + 124 + idx * 24);
    });

  curY += summaryBoxH + 28;

  // Section 3: Recent Logged Expeditions
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('3. СВЕДЕНИЯ О ПОДТВЕРЖДЁННЫХ МАРШРУТАХ (ПОСЛЕДНИЕ ЗАПИСИ)', marginX, curY);
  curY += 16;

  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(marginX, curY);
  ctx.lineTo(marginX + cardW, curY);
  ctx.stroke();
  curY += 26;

  if (data.recentTrips.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText('Записи в «Журнале профессионального опыта» на дату выгрузки отсутствуют.', marginX, curY + 14);
    curY += 64;
  } else {
    // Table Header
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(marginX, curY - 12, cardW, 38);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText('Дата', marginX + 14, curY + 13);
    ctx.fillText('Маршрут', marginX + 150, curY + 13);
    ctx.fillText('Регион', marginX + 660, curY + 13);
    ctx.fillText('КС', marginX + 915, curY + 13);
    ctx.fillText('Группа', marginX + 995, curY + 13);
    curY += 32;

    data.recentTrips.forEach((trip, idx) => {
      const rowY = curY + idx * 42;
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(marginX, rowY - 6, cardW, 40);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(marginX, rowY - 6, cardW, 40);

      ctx.fillStyle = '#334155';
      ctx.font = '15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
      ctx.fillText(trip.date, marginX + 14, rowY + 19);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
      const titleShort =
        trip.routeTitle.length > 44
          ? `${trip.routeTitle.slice(0, 41)}…`
          : trip.routeTitle;
      ctx.fillText(titleShort, marginX + 150, rowY + 19);

      ctx.fillStyle = '#334155';
      ctx.font = '15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
      const regionShort =
        trip.regionName.length > 24
          ? `${trip.regionName.slice(0, 22)}…`
          : trip.regionName;
      ctx.fillText(regionShort, marginX + 660, rowY + 19);
      ctx.fillText(trip.complexity, marginX + 915, rowY + 19);
      ctx.fillText(`${trip.participantsCount} чел.`, marginX + 995, rowY + 19);
    });
    curY += data.recentTrips.length * 42 + 24;
  }

  // Bottom Signature & Verification Block
  const signY = H - 236;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX, signY - 22);
  ctx.lineTo(W - marginX, signY - 22);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Подтверждаю достоверность сведений для аттестационной комиссии РЦА:', marginX, signY + 10);

  ctx.fillStyle = '#475569';
  ctx.font = '16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(`Заявитель: ________________________ / ${data.fullName}`, marginX, signY + 56);
  ctx.fillText(`Дата подачи: ${data.issuedAtFormatted}`, marginX, signY + 92);

  drawVerificationMatrix(
    ctx,
    W - marginX - 118,
    signY - 4,
    108,
    `${data.dossierNumber}:${data.verificationCode}:${data.email}`
  );
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 14px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(data.verificationCode, W - marginX - 64, signY + 124);
  ctx.textAlign = 'left';

  // Footer
  ctx.fillStyle = '#64748b';
  ctx.font = '15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `Учётная карта профиля · РЦА «Русский Восток» · № ${data.dossierNumber} · Проверочный код ${data.verificationCode}`,
    marginX,
    H - 70
  );

  const safeSlug = sanitizeFileSlug(data.fullName, 'guide', 36);
  const fileName = `Profil_Komissiya_RCA_${safeSlug}_${data.issuedAtIso}.pdf`;
  const { previewDataUrl, pdfBlobUrl } = exportCanvasAsA4PortraitPdf(canvas, fileName, options);

  return {
    fileName,
    data,
    previewDataUrl,
    pdfBlobUrl,
  };
}
