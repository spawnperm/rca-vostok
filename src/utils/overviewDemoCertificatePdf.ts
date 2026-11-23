import { jsPDF } from 'jspdf';

export interface OverviewDemoCertificateInput {
  fullName: string;
  region: string;
  track: string;
  category: string;
  readinessPercent: number;
  contour: string;
  now?: Date;
}

export interface OverviewDemoCertificateData {
  certificateId: string;
  fullName: string;
  region: string;
  track: string;
  category: string;
  readinessPercent: number;
  contour: string;
  issuedAtIso: string;
  issuedAtFormatted: string;
  verdictLabel: string;
}

export interface GeneratedOverviewDemoCertificatePdf {
  fileName: string;
  data: OverviewDemoCertificateData;
  previewDataUrl: string;
  pdfBlobUrl: string;
}

function buildDemoCode(seed: string, now: Date): string {
  const year = now.getUTCFullYear();
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9000;
  }
  const num = String(1000 + Math.abs(hash)).padStart(4, '0');
  const md =
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0');
  return `РЦА-ДМ-${year}-${md}-${num}`;
}

export function buildOverviewDemoCertificateData(
  input: OverviewDemoCertificateInput
): OverviewDemoCertificateData {
  const now = input.now ?? new Date();
  const fullName = input.fullName.trim() || 'Соискатель РЦА «Русский Восток»';
  const region = input.region.trim() || 'Приморский край';
  const track = input.track.trim() || 'Пешеходный туризм';
  const category = input.category.trim() || '1–2 категория сложности (КС)';
  const readinessPercent = Math.max(50, Math.min(100, Math.round(input.readinessPercent || 88)));
  const contour = input.contour.trim() || 'Контур А (зачёт подтверждённого стажа)';
  const issuedAtIso = now.toISOString().slice(0, 10);
  const issuedAtFormatted = now.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const verdictLabel =
    readinessPercent >= 80
      ? 'Допущен к очной аттестационной сессии (предварительная проверка пройдена)'
      : 'Рекомендована целевая подготовка перед очной аттестационной сессией';

  return {
    certificateId: buildDemoCode(`${fullName}-${region}-${track}-${readinessPercent}`, now),
    fullName,
    region,
    track,
    category,
    readinessPercent,
    contour,
    issuedAtIso,
    issuedAtFormatted,
    verdictLabel,
  };
}

function drawCircularRcaSeal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  percent: number
): void {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#F0FDFA';
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#0F766E';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, radius - 11, 0, Math.PI * 2);
  ctx.lineWidth = 1.4;
  ctx.setLineDash([5, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0F766E';
  ctx.font = 'bold 13px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('РЦА · ВВГУ', 0, -24);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 30px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(`${percent}%`, 0, 4);

  ctx.fillStyle = '#0F766E';
  ctx.font = 'bold 11px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('ПРЕДВАРИТЕЛЬНО', 0, 30);

  ctx.restore();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Renders the landscape preview certificate mockup onto an HTMLCanvasElement.
 */
export function renderOverviewDemoCertificateToCanvas(
  canvas: HTMLCanvasElement,
  data: OverviewDemoCertificateData
): void {
  const W = 1400;
  const H = 990;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Paper background
  ctx.fillStyle = '#FAFAF7';
  ctx.fillRect(0, 0, W, H);

  // Top decorative contour lines
  ctx.save();
  ctx.strokeStyle = 'rgba(15, 118, 110, 0.06)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.ellipse(1250, 840, 140 + i * 44, 90 + i * 28, -0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(150, 130, 100 + i * 38, 68 + i * 24, 0.25, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Double certificate border
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  ctx.strokeStyle = '#0F766E';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(52, 52, W - 104, H - 104);

  // Corner markers
  ctx.fillStyle = '#0F766E';
  for (const [cx, cy] of [
    [52, 52],
    [W - 52, 52],
    [52, H - 52],
    [W - 52, H - 52],
  ] as const) {
    ctx.fillRect(cx - 5, cy - 5, 10, 10);
  }

  const centerX = W / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Institutional header
  ctx.fillStyle = '#0F766E';
  ctx.font = 'bold 18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    'РЕГИОНАЛЬНЫЙ ЦЕНТР АТТЕСТАЦИИ «РУССКИЙ ВОСТОК» · ВВГУ · ФСТР',
    centerX,
    112
  );

  ctx.fillStyle = '#475569';
  ctx.font = '15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    'Уполномоченная площадка аттестации инструкторов-проводников ДФО (ПП РФ № 1003, № 1893)',
    centerX,
    144
  );

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(200, 174);
  ctx.lineTo(W - 200, 174);
  ctx.stroke();

  // Title
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 44px Georgia, "Times New Roman", serif';
  ctx.fillText('ДЕМОНСТРАЦИОННЫЙ СЕРТИФИКАТ', centerX, 232);

  ctx.fillStyle = '#0F766E';
  ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    'О ПРОХОЖДЕНИИ ПРЕДВАРИТЕЛЬНОЙ АТТЕСТАЦИИ ИНСТРУКТОРА-ПРОВОДНИКА',
    centerX,
    276
  );

  ctx.fillStyle = '#475569';
  ctx.font = '18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Настоящий макет подтверждает, что', centerX, 336);

  // Full name
  ctx.fillStyle = '#0F172A';
  const nameLen = data.fullName.length;
  const nameFontPx = nameLen > 34 ? 32 : nameLen > 25 ? 38 : 44;
  ctx.font = `bold ${nameFontPx}px Georgia, "Times New Roman", serif`;
  ctx.fillText(data.fullName, centerX, 396);

  const lineW = Math.min(840, Math.max(420, ctx.measureText(data.fullName).width + 90));
  ctx.strokeStyle = '#0F766E';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - lineW / 2, 428);
  ctx.lineTo(centerX + lineW / 2, 428);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `Субъект ДФО: ${data.region} · Профиль: ${data.track}`,
    centerX,
    458
  );

  // Summary block
  ctx.fillStyle = '#1E293B';
  ctx.font = '19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  const summaryLines = wrapTextLines(
    ctx,
    `успешно прошёл(а) предварительную проверку готовности к государственной аттестации по категории «${data.category}» (${data.contour}) с итоговым индексом готовности ${data.readinessPercent}%.`,
    1020
  );
  let textY = 508;
  for (const line of summaryLines) {
    ctx.fillText(line, centerX, textY);
    textY += 30;
  }

  // 4 detail cards
  const cardY = 598;
  const cardW = 282;
  const cardH = 114;
  const gap = 18;
  const startX = (W - (cardW * 4 + gap * 3)) / 2;

  const metrics: [string, string][] = [
    ['Направление туризма', data.track],
    ['Категория сложности', data.category],
    ['Трек подготовки', data.contour.split('(')[0].trim()],
    ['Индекс готовности', `${data.readinessPercent}% · Пройдено`],
  ];

  metrics.forEach(([label, val], idx) => {
    const x = startX + idx * (cardW + gap);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, cardY, cardW, cardH);
    ctx.strokeStyle = idx === 3 ? '#0F766E' : '#CBD5E1';
    ctx.lineWidth = idx === 3 ? 2 : 1.5;
    ctx.strokeRect(x, cardY, cardW, cardH);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 13px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(label, x + 16, cardY + 30);

    ctx.fillStyle = idx === 3 ? '#0F766E' : '#0F172A';
    ctx.font = 'bold 16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const valLines = wrapTextLines(ctx, val, cardW - 32).slice(0, 2);
    valLines.forEach((vl, lIdx) => {
      ctx.fillText(vl, x + 16, cardY + 62 + lIdx * 22);
    });
  });

  // Footer: registration metadata + seal + signature
  const footerY = 812;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#334155';
  ctx.font = '15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(`Регистрационный номер: ${data.certificateId}`, 104, footerY - 14);
  ctx.fillText(`Дата формирования: ${data.issuedAtFormatted}`, 104, footerY + 14);

  drawCircularRcaSeal(ctx, centerX, footerY, 62, data.readinessPercent);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('РЦА «Русский Восток» · ИТКИ ВВГУ', W - 104, footerY - 14);
  ctx.fillStyle = '#475569';
  ctx.font = '14px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('г. Владивосток · rca-vostok.ru', W - 104, footerY + 14);

  // Disclaimer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748B';
  ctx.font = '13px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    'ДЕМОНСТРАЦИОННЫЙ МАКЕТ · Предназначен для предварительной оценки и подготовки; не заменяет выписку из ЕФРТА',
    centerX,
    910
  );
}

/**
 * Generates an A4 portrait PDF report containing the visual demo certificate
 * and user attestation summary table, then saves it to disk.
 */
function renderPdfReportPageCanvas(
  data: OverviewDemoCertificateData,
  certPreviewCanvas: HTMLCanvasElement
): HTMLCanvasElement {
  const W = 1654;
  const H = 2339;
  const marginX = 110;
  const contentW = W - marginX * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось создать графический контекст для PDF.');
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Top accent bar
  ctx.fillStyle = '#0F766E';
  ctx.fillRect(0, 0, W, 18);

  let y = 96;
  ctx.fillStyle = '#0F766E';
  ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('РЕГИОНАЛЬНЫЙ ЦЕНТР АТТЕСТАЦИИ «РУССКИЙ ВОСТОК» (ВВГУ)', marginX, y);

  y += 42;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 34px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('PDF-отчёт и демо-сертификат предварительной аттестации', marginX, y);

  y += 32;
  ctx.fillStyle = '#475569';
  ctx.font = '20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(`Рег. код: ${data.certificateId} · Дата формирования: ${data.issuedAtFormatted}`, marginX, y);

  y += 28;
  ctx.strokeStyle = '#0F766E';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(marginX, y);
  ctx.lineTo(W - marginX, y);
  ctx.stroke();

  // Embedded visual certificate preview
  y += 34;
  const certDrawW = contentW;
  const certDrawH = Math.round((certDrawW * 990) / 1400);
  ctx.drawImage(certPreviewCanvas, marginX, y, certDrawW, certDrawH);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(marginX, y, certDrawW, certDrawH);

  // Structured attestation summary table below certificate
  y += certDrawH + 54;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 26px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('Сводные данные предварительной аттестации соискателя', marginX, y);

  y += 26;
  const rows: [string, string][] = [
    ['ФИО соискателя', data.fullName],
    ['Регион ДФО', data.region],
    ['Направление подготовки', data.track],
    ['Целевая категория', data.category],
    ['Образовательный контур', data.contour],
    ['Итоговый индекс готовности', `${data.readinessPercent}%`],
    ['Заключение системы РЦА', data.verdictLabel],
  ];

  const rowH = 58;
  rows.forEach(([label, val], idx) => {
    const ry = y + idx * rowH;
    ctx.fillStyle = idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
    ctx.fillRect(marginX, ry, contentW, rowH);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(marginX, ry, contentW, rowH);

    ctx.fillStyle = '#475569';
    ctx.font = '20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(label, marginX + 20, ry + 36);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(val, marginX + 430, ry + 36);
  });

  // Bottom footer
  const footerY = H - 80;
  ctx.strokeStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.moveTo(marginX, footerY - 26);
  ctx.lineTo(W - marginX, footerY - 26);
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = '16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    'Сформировано на платформе РЦА «Русский Восток» · Демонстрационный отчёт для подготовки к экзамену (ФЗ № 132-ФЗ)',
    marginX,
    footerY
  );

  return canvas;
}

function slugifyName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 36) || 'candidate'
  );
}

export function generateOverviewDemoCertificatePdf(
  input: OverviewDemoCertificateInput
): GeneratedOverviewDemoCertificatePdf {
  const data = buildOverviewDemoCertificateData(input);
  const certCanvas = document.createElement('canvas');
  renderOverviewDemoCertificateToCanvas(certCanvas, data);
  const previewDataUrl = certCanvas.toDataURL('image/png');

  const pageCanvas = renderPdfReportPageCanvas(data, certCanvas);
  const pageDataUrl = pageCanvas.toDataURL('image/png');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pdf.addImage(pageDataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

  const fileName = `Demo_Certificate_RCA_${slugifyName(data.fullName)}_${data.issuedAtIso}.pdf`;
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
