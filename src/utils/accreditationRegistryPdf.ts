import { jsPDF } from 'jspdf';
import type { AccreditationRegistryEntry } from '../data/dfoOverviewRegistryData.ts';
import { formatRussianDate } from './personalRoadmap.ts';

export interface AccreditationExportPayload {
  docNumber: string;
  exportedAtIso: string;
  exportedAtFormatted: string;
  filterLabel: string;
  totalCount: number;
  verifiedCount: number;
  inProgressCount: number;
  entries: AccreditationRegistryEntry[];
}

export interface AccreditationPdfExportResult {
  fileName: string;
  payload: AccreditationExportPayload;
}

export function buildAccreditationExportPayload(
  entries: AccreditationRegistryEntry[],
  filterLabel = 'Все записи',
  now = new Date()
): AccreditationExportPayload {
  const exportedAtIso = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  const mmdd =
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0');
  const docNumber = `РЦА-${year}/РА-${mmdd}-${String(entries.length).padStart(2, '0')}`;

  const inProgressCount = entries.filter((e) => e.status === 'in_progress').length;
  return {
    docNumber,
    exportedAtIso,
    exportedAtFormatted: formatRussianDate(exportedAtIso),
    filterLabel,
    totalCount: entries.length,
    verifiedCount: entries.length - inProgressCount,
    inProgressCount,
    entries,
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

function renderRegistryPageCanvas(
  payload: AccreditationExportPayload,
  rowsSubset: AccreditationRegistryEntry[],
  pageNumber: number,
  totalPages: number
): HTMLCanvasElement {
  // 200 DPI A4 landscape
  const W = 2339;
  const H = 1654;
  const marginX = 110;
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

  // Top institutional accent bar
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(0, 0, W, 16);

  // Header block
  let y = 78;
  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    'РЕГИОНАЛЬНЫЙ ЦЕНТР АТТЕСТАЦИИ «РУССКИЙ ВОСТОК» · ФГБОУ ВО «ВВГУ»',
    marginX,
    y
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = '#475569';
  ctx.font = '18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `Выписка № ${payload.docNumber} · ${payload.exportedAtFormatted} г.`,
    W - marginX,
    y
  );
  ctx.textAlign = 'left';

  y += 42;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 34px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText('РЕЕСТР АККРЕДИТАЦИИ И ЛИЦЕНЗИРОВАНИЯ ДЕЯТЕЛЬНОСТИ', marginX, y);

  y += 30;
  ctx.fillStyle = '#475569';
  ctx.font = '19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `Фильтр: ${payload.filterLabel} · Всего записей: ${payload.totalCount} (Действующих/подтверждённых: ${payload.verifiedCount}, в разработке: ${payload.inProgressCount})`,
    marginX,
    y
  );

  y += 24;
  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(marginX, y);
  ctx.lineTo(W - marginX, y);
  ctx.stroke();

  // Table columns geometry
  y += 34;
  const colWidths = [470, 390, 310, 689, 260]; // Sum = 2119 = contentW
  const colX = [
    marginX,
    marginX + colWidths[0],
    marginX + colWidths[0] + colWidths[1],
    marginX + colWidths[0] + colWidths[1] + colWidths[2],
    marginX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
  ];

  // Table header
  const headerH = 50;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(marginX, y, contentW, headerH);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  const headers = [
    'Документ / Правовой контур',
    'Норма РФ и реквизиты',
    'Надзорный орган / Оператор',
    'Область действия и срок',
    'Статус',
  ];
  headers.forEach((h, idx) => {
    ctx.fillText(h, colX[idx] + 16, y + 31);
  });

  y += headerH;

  rowsSubset.forEach((entry, rowIdx) => {
    ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const docLines = wrapLines(ctx, entry.documentName, colWidths[0] - 32);

    ctx.font = 'bold 16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const normLines = wrapLines(ctx, entry.legalNorm, colWidths[1] - 32);
    ctx.font = '15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const regLines = wrapLines(ctx, entry.registryNumber, colWidths[1] - 32);

    ctx.font = '16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const authLines = wrapLines(ctx, entry.issuingAuthority, colWidths[2] - 32);

    ctx.font = '16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const scopeLines = wrapLines(ctx, entry.scopeAndTerms, colWidths[3] - 32);

    const maxLines = Math.max(
      docLines.length + 1,
      normLines.length + regLines.length,
      authLines.length,
      scopeLines.length + 1
    );
    const rowH = Math.max(94, 34 + maxLines * 24 + 14);

    ctx.fillStyle = rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(marginX, y, contentW, rowH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(marginX, y, contentW, rowH);

    // Col 0: Category + Document name
    ctx.fillStyle = '#0f766e';
    ctx.font = 'bold 14px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(entry.categoryLabel, colX[0] + 16, y + 28);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    docLines.forEach((line, i) => {
      ctx.fillText(line, colX[0] + 16, y + 54 + i * 24);
    });

    // Col 1: RF legal norm + registry ref
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    normLines.forEach((line, i) => {
      ctx.fillText(line, colX[1] + 16, y + 32 + i * 23);
    });
    ctx.fillStyle = '#64748b';
    ctx.font = '15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const regStartY = y + 34 + normLines.length * 23 + 6;
    regLines.forEach((line, i) => {
      ctx.fillText(line, colX[1] + 16, regStartY + i * 21);
    });

    // Col 2: Authority
    ctx.fillStyle = '#334155';
    ctx.font = '16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    authLines.forEach((line, i) => {
      ctx.fillText(line, colX[2] + 16, y + 32 + i * 23);
    });

    // Col 3: Scope + valid until
    ctx.fillStyle = '#334155';
    ctx.font = '16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    scopeLines.forEach((line, i) => {
      ctx.fillText(line, colX[3] + 16, y + 32 + i * 23);
    });
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(
      `Срок действия: ${entry.validUntil}`,
      colX[3] + 16,
      y + 38 + scopeLines.length * 23 + 4
    );

    // Col 4: Status badge
    const badgeBg =
      entry.status === 'active'
        ? '#f0fdfa'
        : entry.status === 'updated_2026'
          ? '#f0f9ff'
          : '#fffbeb';
    const badgeBorder =
      entry.status === 'active'
        ? '#99f6e4'
        : entry.status === 'updated_2026'
          ? '#bae6fd'
          : '#fde68a';
    const badgeText =
      entry.status === 'active'
        ? '#115e59'
        : entry.status === 'updated_2026'
          ? '#0c4a6e'
          : '#78350f';

    const bx = colX[4] + 16;
    const by = y + 20;
    const bw = colWidths[4] - 32;
    const bh = 38;
    ctx.fillStyle = badgeBg;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = badgeBorder;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = badgeText;
    ctx.font = 'bold 16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(`✓ ${entry.statusLabel}`, bx + 14, by + 25);

    y += rowH;
  });

  // Footer
  const footerY = H - 64;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX, footerY - 26);
  ctx.lineTo(W - marginX, footerY - 26);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    'Официальные сведения о лицензировании ВВГУ (ДПО) и полномочиях РЦА «Русский Восток» (https://rca-vostok.ru)',
    marginX,
    footerY
  );
  ctx.textAlign = 'right';
  ctx.fillText(`Страница ${pageNumber} из ${totalPages}`, W - marginX, footerY);
  ctx.textAlign = 'left';

  return canvas;
}

export function exportAccreditationRegistryPdf(
  entries: AccreditationRegistryEntry[],
  filterLabel = 'Все записи'
): AccreditationPdfExportResult {
  const payload = buildAccreditationExportPayload(entries, filterLabel);

  // Split safely across pages if many rows (max 6 rows per landscape page for comfortable readability)
  const rowsPerPage = 6;
  const chunks: AccreditationRegistryEntry[][] = [];
  for (let i = 0; i < entries.length; i += rowsPerPage) {
    chunks.push(entries.slice(i, i + rowsPerPage));
  }
  if (chunks.length === 0) {
    chunks.push([]);
  }

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  chunks.forEach((chunk, index) => {
    if (index > 0) {
      pdf.addPage('a4', 'landscape');
    }
    const canvas = renderRegistryPageCanvas(payload, chunk, index + 1, chunks.length);
    const imgUrl = canvas.toDataURL('image/png');
    pdf.addImage(imgUrl, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
  });

  const fileName = `Reestr_Akkreditacii_RCA_VVGU_${payload.exportedAtIso}.pdf`;
  pdf.save(fileName);

  return { fileName, payload };
}
