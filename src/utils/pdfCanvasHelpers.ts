import { jsPDF } from 'jspdf';

/**
 * Shared Canvas 2D & jsPDF utilities used across certificate, dossier, resume,
 * learning plan, and analytics PDF generators.
 */

export function deterministicHash(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function sanitizeFileSlug(name: string, fallback = 'document', maxLength = 40): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, maxLength) || fallback
  );
}

export function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

export function truncateTextToFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 4 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
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

export function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  if (!src || typeof Image === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function drawVerificationMatrix(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  seed: string,
  options: { framedPadding?: number } = {}
): void {
  const cells = 9;
  const cellSize = size / cells;
  const pad = options.framedPadding ?? 0;
  let hash = deterministicHash(seed);

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.fillRect(x - pad, y - pad, size + pad * 2, size + pad * 2);
  ctx.strokeRect(x - pad, y - pad, size + pad * 2, size + pad * 2);

  ctx.fillStyle = '#0f172a';
  for (let r = 0; r < cells; r += 1) {
    for (let c = 0; c < cells; c += 1) {
      const isCorner =
        (r < 3 && c < 3) ||
        (r < 3 && c >= cells - 3) ||
        (r >= cells - 3 && c < 3);
      let filled = false;
      if (isCorner) {
        const localR = r >= cells - 3 ? r - (cells - 3) : r;
        const localC = c >= cells - 3 ? c - (cells - 3) : c;
        filled =
          localR === 0 ||
          localR === 2 ||
          localC === 0 ||
          localC === 2 ||
          (localR === 1 && localC === 1);
      } else {
        hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
        filled = (hash & 1) === 1;
      }

      if (filled) {
        ctx.fillRect(
          x + c * cellSize + 0.5,
          y + r * cellSize + 0.5,
          cellSize - 1,
          cellSize - 1
        );
      }
    }
  }
  ctx.restore();
}

export function exportCanvasAsA4PortraitPdf(
  canvas: HTMLCanvasElement,
  fileName: string,
  options: { autoDownload?: boolean } = {}
): { previewDataUrl: string; pdfBlobUrl: string } {
  const previewDataUrl = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  pdf.addImage(previewDataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
  const pdfBlob = pdf.output('blob');
  const pdfBlobUrl = URL.createObjectURL(pdfBlob);

  if (options.autoDownload !== false) {
    pdf.save(fileName);
  }

  return { previewDataUrl, pdfBlobUrl };
}
