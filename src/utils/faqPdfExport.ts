import { jsPDF } from 'jspdf';
import type { FaqItem } from '../data/researchData.ts';
import { formatRussianDate } from './personalRoadmap.ts';

export interface FaqExportItem {
  id: string;
  categoryLabel: string;
  question: string;
  answer: string;
}

export interface FaqExportPayload {
  docNumber: string;
  exportedAtIso: string;
  exportedAtFormatted: string;
  scopeLabel: string;
  totalQuestions: number;
  items: FaqExportItem[];
}

export interface FaqPdfExportResult {
  fileName: string;
  payload: FaqExportPayload;
}

export function buildFaqExportPayload(
  items: readonly (FaqItem | FaqExportItem)[],
  scopeLabel = 'Полный справочник соискателя',
  now = new Date()
): FaqExportPayload {
  const exportedAtIso = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  const mmdd =
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0');

  return {
    docNumber: `РЦА-${year}/FAQ-${mmdd}`,
    exportedAtIso,
    exportedAtFormatted: formatRussianDate(exportedAtIso),
    scopeLabel,
    totalQuestions: items.length,
    items: items.map((item) => ({
      id: item.id,
      categoryLabel: item.categoryLabel,
      question: item.question,
      answer: item.answer,
    })),
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

interface MeasuredFaqBlock {
  index: number;
  item: FaqExportItem;
  questionLines: string[];
  answerLines: string[];
  totalHeight: number;
}

function createFaqPageCanvas(
  payload: FaqExportPayload,
  isFirstPage: boolean
): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  startY: number;
  maxContentY: number;
  marginX: number;
  contentW: number;
} {
  // 150 DPI A4 portrait: crisp print readability with fast client rendering
  const W = 1240;
  const H = 1754;
  const marginX = 90;
  const contentW = W - marginX * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось инициализировать графический контекст для формирования PDF.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Institutional top accent bar
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(0, 0, W, 14);

  let y = 66;
  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('РЦА «РУССКИЙ ВОСТОК» · ВВГУ / ФСТР', marginX, y);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#475569';
  ctx.font = '15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(`${payload.docNumber} · ${payload.exportedAtFormatted} г.`, W - marginX, y);
  ctx.textAlign = 'left';

  if (isFirstPage) {
    y += 38;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText('ПАМЯТКА КАНДИДАТУ: БАЗА ЗНАНИЙ (FAQ)', marginX, y);

    y += 28;
    ctx.fillStyle = '#475569';
    ctx.font = '16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(
      `Ответы на типовые вопросы по аттестации инструкторов-проводников · Вопросов: ${payload.totalQuestions}`,
      marginX,
      y
    );

    y += 22;
    ctx.fillStyle = '#64748b';
    ctx.font = '14px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(
      'г. Владивосток, ул. Гоголя, д. 41 (ВВГУ) · +7 (991) 809 08 70 · russian_east@bk.ru · https://rca-vostok.ru',
      marginX,
      y
    );

    y += 18;
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(marginX, y);
    ctx.lineTo(W - marginX, y);
    ctx.stroke();

    y += 28;
  } else {
    y += 18;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(marginX, y);
    ctx.lineTo(W - marginX, y);
    ctx.stroke();
    y += 28;
  }

  return {
    canvas,
    ctx,
    startY: y,
    maxContentY: H - 96,
    marginX,
    contentW,
  };
}

function finalizePageFooter(
  ctx: CanvasRenderingContext2D,
  pageNumber: number,
  totalPages: number,
  payload: FaqExportPayload
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const marginX = 90;
  const footerY = H - 50;

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(marginX, footerY - 22);
  ctx.lineTo(W - marginX, footerY - 22);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '13px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `РЦА «Русский Восток» · Справочник соискателя (${payload.scopeLabel})`,
    marginX,
    footerY
  );

  ctx.textAlign = 'right';
  ctx.fillText(`Стр. ${pageNumber} из ${totalPages}`, W - marginX, footerY);
  ctx.textAlign = 'left';
}

function renderFaqPages(payload: FaqExportPayload): HTMLCanvasElement[] {
  const probe = createFaqPageCanvas(payload, true);
  const { ctx: measureCtx, contentW, marginX } = probe;
  const cardPadX = 20;
  const textMaxW = contentW - cardPadX * 2;

  const measuredBlocks: MeasuredFaqBlock[] = payload.items.map((item, idx) => {
    measureCtx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const questionLines = wrapLines(measureCtx, `${String(idx + 1).padStart(2, '0')}. ${item.question}`, textMaxW);

    measureCtx.font = '15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const answerLines = wrapLines(measureCtx, item.answer, textMaxW);

    const headerHeight = 26;
    const questionHeight = questionLines.length * 23;
    const answerHeight = answerLines.length * 21;
    const totalHeight = 16 + headerHeight + questionHeight + 10 + answerHeight + 18;

    return {
      index: idx,
      item,
      questionLines,
      answerLines,
      totalHeight,
    };
  });

  const pagesData: MeasuredFaqBlock[][] = [];
  let currentPageBlocks: MeasuredFaqBlock[] = [];
  let cursorY = probe.startY;
  const firstPageLimit = probe.maxContentY;
  const nextPageStartY = 112;
  const nextPageLimit = 1754 - 96;

  for (const block of measuredBlocks) {
    const pageLimit = pagesData.length === 0 ? firstPageLimit : nextPageLimit;
    if (
      currentPageBlocks.length > 0 &&
      cursorY + block.totalHeight > pageLimit
    ) {
      pagesData.push(currentPageBlocks);
      currentPageBlocks = [];
      cursorY = nextPageStartY;
    }
    currentPageBlocks.push(block);
    cursorY += block.totalHeight + 14;
  }

  if (currentPageBlocks.length > 0 || pagesData.length === 0) {
    pagesData.push(currentPageBlocks);
  }

  const totalPages = pagesData.length;

  return pagesData.map((blocks, pageIdx) => {
    const page = createFaqPageCanvas(payload, pageIdx === 0);
    const { canvas, ctx } = page;
    let y = page.startY;

    for (const block of blocks) {
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.2;
      ctx.fillRect(marginX, y, contentW, block.totalHeight);
      ctx.strokeRect(marginX, y, contentW, block.totalHeight);

      // Left teal accent stripe
      ctx.fillStyle = '#0f766e';
      ctx.fillRect(marginX, y, 5, block.totalHeight);

      let innerY = y + 24;
      ctx.fillStyle = '#0f766e';
      ctx.font = 'bold 12px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
      ctx.fillText(block.item.categoryLabel.toUpperCase(), marginX + cardPadX, innerY);

      innerY += 24;
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
      for (const qLine of block.questionLines) {
        ctx.fillText(qLine, marginX + cardPadX, innerY);
        innerY += 23;
      }

      innerY += 6;
      ctx.fillStyle = '#334155';
      ctx.font = '15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
      for (const aLine of block.answerLines) {
        ctx.fillText(aLine, marginX + cardPadX, innerY);
        innerY += 21;
      }

      y += block.totalHeight + 14;
    }

    finalizePageFooter(ctx, pageIdx + 1, totalPages, payload);
    return canvas;
  });
}

export function generateFaqPdf(
  items: readonly (FaqItem | FaqExportItem)[],
  scopeLabel = 'Полный справочник соискателя'
): FaqPdfExportResult {
  const payload = buildFaqExportPayload(items, scopeLabel);
  const canvases = renderFaqPages(payload);

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

  const fileName = `RCA_Vostok_FAQ_${payload.exportedAtIso}.pdf`;
  pdf.save(fileName);

  return { fileName, payload };
}
