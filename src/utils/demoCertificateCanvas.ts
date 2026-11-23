import type {
  AttestationDiagnosticsEvaluation,
  DiagnosticSectionStatus,
} from './attestationSelfDiagnostics.ts';
import type { SessionUser } from './identityApi.ts';

export const DEMO_CERTIFICATE_THRESHOLD_PERCENT = 80;

export interface DemoCertificateSectionLine {
  title: string;
  shortTitle: string;
  correctCount: number;
  totalCount: number;
  scorePercent: number;
  status: DiagnosticSectionStatus;
}

export interface DemoCertificatePayload {
  certificateId: string;
  candidateName: string;
  region: string;
  overallPercent: number;
  correctCount: number;
  totalQuestions: number;
  issuedAtLabel: string;
  sectionScores: DemoCertificateSectionLine[];
}

export function isEligibleForDemoCertificate(
  evaluation: AttestationDiagnosticsEvaluation
): boolean {
  return (
    evaluation.isComplete &&
    evaluation.overallPercent > DEMO_CERTIFICATE_THRESHOLD_PERCENT
  );
}

export function buildDemoCertificateId(seed: string, now = new Date()): string {
  const year = now.getUTCFullYear();
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33 + seed.charCodeAt(i)) % 9000;
  }
  const suffix = String(1000 + Math.abs(hash)).padStart(4, '0');
  const monthDay =
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0');
  return `DEMO-РЦА-${year}-${monthDay}-${suffix}`;
}

export function buildDemoCertificatePayload(params: {
  user: SessionUser | null;
  customCandidateName?: string;
  evaluation: AttestationDiagnosticsEvaluation;
  now?: Date;
}): DemoCertificatePayload {
  const now = params.now ?? new Date();
  const trimmedCustom = params.customCandidateName?.trim();
  const candidateName =
    trimmedCustom ||
    params.user?.fullName?.trim() ||
    'Кандидат в инструкторы-проводники ДФО';

  const region = params.user?.region?.trim() || 'Дальневосточный федеральный округ';

  const issuedAtLabel = now.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const seed = `${params.user?.id ?? 'guest'}-${candidateName}-${params.evaluation.overallPercent}`;

  return {
    certificateId: buildDemoCertificateId(seed, now),
    candidateName,
    region,
    overallPercent: params.evaluation.overallPercent,
    correctCount: params.evaluation.correctCount,
    totalQuestions: params.evaluation.totalQuestions,
    issuedAtLabel,
    sectionScores: params.evaluation.sections.map((s) => ({
      title: s.title,
      shortTitle: s.shortTitle,
      correctCount: s.correctCount,
      totalCount: s.totalCount,
      scorePercent: s.scorePercent,
      status: s.status,
    })),
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawWrappedCenterText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(/\s+/);
  let line = '';
  let y = startY;

  for (let i = 0; i < words.length; i += 1) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, centerX, y);
      line = words[i];
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, centerX, y);
    y += lineHeight;
  }
  return y;
}

export function renderDemoCertificateToCanvas(
  canvas: HTMLCanvasElement,
  payload: DemoCertificatePayload
): void {
  const W = 1400;
  const H = 990;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Archival warm paper backdrop
  ctx.fillStyle = '#FAFAF7';
  ctx.fillRect(0, 0, W, H);

  // Subtle decorative topographic contour rings in bottom-right & top-left
  ctx.save();
  ctx.strokeStyle = 'rgba(15, 118, 110, 0.065)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i += 1) {
    ctx.beginPath();
    ctx.ellipse(1260, 860, 140 + i * 48, 90 + i * 32, -0.35, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(120, 110, 90 + i * 42, 65 + i * 26, 0.25, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 2. Outer slate & inner teal double certificate frame
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  ctx.strokeStyle = '#0F766E';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(52, 52, W - 104, H - 104);

  // Corner precision ticks
  const cornerCoords: [number, number][] = [
    [52, 52],
    [W - 52, 52],
    [52, H - 52],
    [W - 52, H - 52],
  ];
  ctx.fillStyle = '#0F766E';
  for (const [cx, cy] of cornerCoords) {
    ctx.fillRect(cx - 5, cy - 5, 10, 10);
  }

  // 3. Institutional header banner
  const centerX = W / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#0F766E';
  ctx.font = '600 18px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText(
    'РЕГИОНАЛЬНЫЙ ЦЕНТР АТТЕСТАЦИИ «РУССКИЙ ВОСТОК» · ВВГУ',
    centerX,
    118
  );

  ctx.fillStyle = '#475569';
  ctx.font = '500 15px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText(
    'Учебный трек подготовки инструкторов-проводников Дальневосточного федерального округа',
    centerX,
    148
  );

  // Hairline rule under header
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(220, 176);
  ctx.lineTo(W - 220, 176);
  ctx.stroke();

  // 4. Main Certificate Title
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 46px "Source Serif 4", Georgia, serif';
  ctx.fillText('ДЕМО-СЕРТИФИКАТ', centerX, 232);

  ctx.fillStyle = '#0F766E';
  ctx.font = '600 22px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText('О ПРОХОЖДЕНИИ САМОДИАГНОСТИКИ ГОТОВНОСТИ К АТТЕСТАЦИИ', centerX, 276);

  // 5. Recipient Confirmation Line
  ctx.fillStyle = '#475569';
  ctx.font = '500 18px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText('Настоящий документ подтверждает, что', centerX, 342);

  // Candidate Full Name
  ctx.fillStyle = '#0F172A';
  let nameFontSize = 44;
  if (payload.candidateName.length > 34) nameFontSize = 34;
  else if (payload.candidateName.length > 26) nameFontSize = 38;
  ctx.font = `700 ${nameFontSize}px "Source Serif 4", Georgia, serif`;
  ctx.fillText(payload.candidateName, centerX, 404);

  // Decorative underline below recipient name
  const nameWidth = Math.min(820, Math.max(420, ctx.measureText(payload.candidateName).width + 80));
  ctx.strokeStyle = '#0F766E';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - nameWidth / 2, 434);
  ctx.lineTo(centerX + nameWidth / 2, 434);
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = '500 16px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText(`Регион подготовки: ${payload.region}`, centerX, 462);

  // 6. Score Summary Prose
  ctx.fillStyle = '#1E293B';
  ctx.font = '500 20px "Plus Jakarta Sans", -apple-system, sans-serif';
  drawWrappedCenterText(
    ctx,
    `успешно завершил(а) проверочный тест самодиагностики по нормативной базе, паспортизации маршрутов, первой помощи (WFA) и тактике ДФО с итоговым результатом ${payload.overallPercent}% (${payload.correctCount} из ${payload.totalQuestions} верных ответов).`,
    centerX,
    514,
    1020,
    30
  );

  // 7. 4-Section Result Cards
  const cardsY = 602;
  const cardGap = 20;
  const cardW = 278;
  const cardH = 122;
  const totalGridW = cardW * 4 + cardGap * 3;
  const gridStartX = (W - totalGridW) / 2;

  payload.sectionScores.slice(0, 4).forEach((sec, idx) => {
    const x = gridStartX + idx * (cardW + cardGap);
    ctx.fillStyle = '#FFFFFF';
    drawRoundedRect(ctx, x, cardsY, cardW, cardH, 10);
    ctx.fill();

    ctx.strokeStyle = sec.scorePercent >= 80 ? '#99F6E4' : '#E2E8F0';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, x, cardsY, cardW, cardH, 10);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748B';
    ctx.font = '600 13px "Plus Jakarta Sans", -apple-system, sans-serif';
    ctx.fillText(`Раздел ${idx + 1}`, x + 18, cardsY + 26);

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 15px "Plus Jakarta Sans", -apple-system, sans-serif';
    ctx.fillText(sec.shortTitle, x + 18, cardsY + 50);

    ctx.fillStyle = sec.scorePercent >= 80 ? '#0F766E' : '#B45309';
    ctx.font = '700 26px "JetBrains Mono", monospace';
    ctx.fillText(`${sec.scorePercent}%`, x + 18, cardsY + 90);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillText(`${sec.correctCount}/${sec.totalCount}`, x + cardW - 18, cardsY + 92);
  });

  // 8. Official-style Verification Seal + Metadata Footer
  const footerY = 812;

  // Left block: Issue metadata
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = '500 15px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText(`Регистрационный код: ${payload.certificateId}`, 106, footerY - 12);
  ctx.fillText(`Дата формирования: ${payload.issuedAtLabel}`, 106, footerY + 18);

  // Center seal emblem
  ctx.save();
  ctx.translate(centerX, footerY);
  ctx.beginPath();
  ctx.arc(0, 0, 56, 0, Math.PI * 2);
  ctx.fillStyle = '#F0FDFA';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0F766E';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F766E';
  ctx.font = '700 12px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText('РЦА ВВГУ', 0, -16);
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 24px "JetBrains Mono", monospace';
  ctx.fillText(`${payload.overallPercent}%`, 0, 8);
  ctx.fillStyle = '#0F766E';
  ctx.font = '600 10px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText('ГОТОВ К ЭКЗАМЕНУ', 0, 28);
  ctx.restore();

  // Right block: Advisory signoff
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0F172A';
  ctx.font = '600 15px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText('Платформа самоподготовки РЦА «Русский Восток»', W - 106, footerY - 12);
  ctx.fillStyle = '#475569';
  ctx.font = '500 14px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText('Порог допуска к демо-сертификату: > 80%', W - 106, footerY + 18);

  // 9. Explicit educational disclaimer at bottom
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748B';
  ctx.font = '500 13px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText(
    'УЧЕБНЫЙ ДЕМО-СЕРТИФИКАТ САМОДИАГНОСТИКИ · Не является выпиской из ЕФРТА и не заменяет очную аттестацию по ФЗ № 132-ФЗ',
    centerX,
    906
  );
}
