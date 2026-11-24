import { jsPDF } from 'jspdf';
import {
  ATTESTATION_KIND_COLORS,
  ATTESTATION_KIND_FILTERS,
  type AttestationLocationFilterId,
  type DfoAttestationLocation,
} from './attestationLocationsMap.ts';

export interface AttestationLocationsExportOptions {
  locations: readonly DfoAttestationLocation[];
  regionFilter: string;
  kindFilter: AttestationLocationFilterId;
  searchQuery: string;
  exportedAt?: Date;
}

export interface AttestationLocationsPdfModel {
  documentNumber: string;
  fileNameBase: string;
  generatedAtLabel: string;
  filterSummary: string;
  totalVenues: number;
  regionsCount: number;
  headquartersCount: number;
  fieldPolygonsCount: number;
  regionalHubsCount: number;
  pages: DfoAttestationLocation[][];
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function transliterateSlug(input: string): string {
  const lowered = input.trim().toLowerCase();
  let result = '';
  for (const ch of lowered) {
    if (ch in CYRILLIC_TO_LATIN) {
      result += CYRILLIC_TO_LATIN[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      result += ch;
    } else {
      result += '-';
    }
  }
  return result.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'dfo';
}

export function formatAttestationExportFileSlug(
  regionFilter: string,
  kindFilter: AttestationLocationFilterId
): string {
  const regionPart = regionFilter === 'all' ? 'dfo' : transliterateSlug(regionFilter);
  const kindPart = kindFilter === 'all' ? '' : `-${kindFilter.replace('_', '-')}`;
  return `${regionPart}${kindPart}`;
}

export function buildAttestationLocationsFilterSummary(
  options: Pick<AttestationLocationsExportOptions, 'regionFilter' | 'kindFilter' | 'searchQuery'>
): string {
  const regionLabel =
    options.regionFilter === 'all' ? 'Все регионы ДФО' : options.regionFilter;
  const kindLabel =
    ATTESTATION_KIND_FILTERS.find((f) => f.id === options.kindFilter)?.label ??
    'Все площадки ДФО';
  const query = options.searchQuery.trim();
  const base = `Регион: ${regionLabel} · Тип: ${kindLabel}`;
  return query ? `${base} · Поиск: «${query}»` : base;
}

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[;"\r\n,]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildAttestationLocationsCsvContent(
  options: AttestationLocationsExportOptions
): string {
  const now = options.exportedAt ?? new Date();
  const filterSummary = buildAttestationLocationsFilterSummary(options);
  const lines: string[] = [];

  const pushRow = (cols: readonly (string | number)[]) => {
    lines.push(cols.map(csvEscape).join(';'));
  };

  pushRow(['Реестр аттестованных площадок ДФО для работы комиссий · РЦА «Русский Восток» (ВВГУ · ФСТР)']);
  pushRow(['Дата формирования', now.toLocaleString('ru-RU')]);
  pushRow(['Активные фильтры выборки', filterSummary]);
  pushRow(['Количество площадок в выгрузке', options.locations.length]);
  lines.push('');

  pushRow([
    '№ п/п',
    'Код',
    'Субъект ДФО',
    'Город / округ',
    'Наименование площадки',
    'Тип площадки',
    'Адрес и ориентир',
    'Координаты (WGS-84)',
    'Дисциплины и КС',
    'Форматы очных испытаний',
    'Ближайшие сессии 2027',
    'Кураторы комиссии',
    'Пропускная способность и режим',
    'Нормативное основание',
  ]);

  options.locations.forEach((loc, index) => {
    pushRow([
      index + 1,
      loc.badgeCode,
      loc.regionName,
      loc.city,
      loc.name,
      loc.kindLabel,
      loc.address,
      `${loc.coordinates.lat.toFixed(4)}, ${loc.coordinates.lng.toFixed(4)}`,
      loc.disciplines.join('; '),
      loc.trialFormats.join(' | '),
      loc.nextSessions,
      loc.chairName,
      loc.capacityNote,
      loc.protocolNote,
    ]);
  });

  return '\uFEFF' + lines.join('\r\n');
}

export function buildAttestationLocationsPdfModel(
  options: AttestationLocationsExportOptions
): AttestationLocationsPdfModel {
  const now = options.exportedAt ?? new Date();
  const isoDate = now.toISOString().slice(0, 10);
  const compactDate = isoDate.replace(/-/g, '');
  const slug = formatAttestationExportFileSlug(options.regionFilter, options.kindFilter);

  const uniqueRegions = new Set(options.locations.map((loc) => loc.regionName));
  const headquartersCount = options.locations.filter((l) => l.kind === 'headquarters').length;
  const fieldPolygonsCount = options.locations.filter((l) => l.kind === 'field_polygon').length;
  const regionalHubsCount = options.locations.filter((l) => l.kind === 'regional_hub').length;

  const pageSize = 3;
  const pages: DfoAttestationLocation[][] = [];
  for (let i = 0; i < options.locations.length; i += pageSize) {
    pages.push(options.locations.slice(i, i + pageSize));
  }
  if (pages.length === 0) {
    pages.push([]);
  }

  return {
    documentNumber: `РЦА-ПЛЩ-${compactDate}`,
    fileNameBase: `rca-vostok-venues-${slug}-${isoDate}`,
    generatedAtLabel: now.toLocaleString('ru-RU'),
    filterSummary: buildAttestationLocationsFilterSummary(options),
    totalVenues: options.locations.length,
    regionsCount: uniqueRegions.size,
    headquartersCount,
    fieldPolygonsCount,
    regionalHubsCount,
    pages,
  };
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportAttestationLocationsCsv(options: AttestationLocationsExportOptions): string {
  const now = options.exportedAt ?? new Date();
  const isoDate = now.toISOString().slice(0, 10);
  const slug = formatAttestationExportFileSlug(options.regionFilter, options.kindFilter);
  const fileName = `rca-vostok-venues-${slug}-${isoDate}.csv`;
  const csv = buildAttestationLocationsCsvContent(options);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, fileName);
  return fileName;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines) {
        return lines;
      }
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

function drawVenueCard(
  ctx: CanvasRenderingContext2D,
  loc: DfoAttestationLocation,
  orderIndex: number,
  x: number,
  y: number,
  w: number,
  fontSans: string,
  fontMono: string
): number {
  const cardH = 362;
  const accentColor = ATTESTATION_KIND_COLORS[loc.kind];

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.6;
  drawRoundedRect(ctx, x, y, w, cardH, 12);
  ctx.fill();
  ctx.stroke();

  // Top strip inside card
  ctx.fillStyle = '#F8FAFC';
  drawRoundedRect(ctx, x + 1, y + 1, w - 2, 54, 11);
  ctx.fill();

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 55);
  ctx.lineTo(x + w, y + 55);
  ctx.stroke();

  // Badge dot & code
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(x + 26, y + 28, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0F172A';
  ctx.font = `700 14px ${fontMono}`;
  ctx.fillText(`#${orderIndex} · ${loc.badgeCode}`, x + 42, y + 33);

  ctx.fillStyle = accentColor;
  ctx.font = `600 14px ${fontSans}`;
  ctx.fillText(`${loc.kindLabel} · ${loc.regionName}`, x + 185, y + 33);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#475569';
  ctx.font = `500 13px ${fontMono}`;
  ctx.fillText(
    `${loc.coordinates.lat.toFixed(4)}° N, ${loc.coordinates.lng.toFixed(4)}° E`,
    x + w - 20,
    y + 33
  );
  ctx.textAlign = 'left';

  // Title & Address
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 19px ${fontSans}`;
  const titleLines = wrapText(ctx, loc.name, w - 40, 1);
  ctx.fillText(titleLines[0] ?? loc.name, x + 20, y + 86);

  ctx.fillStyle = '#475569';
  ctx.font = `400 14px ${fontSans}`;
  const addrLines = wrapText(ctx, `Адрес: ${loc.city}, ${loc.address}`, w - 40, 1);
  ctx.fillText(addrLines[0] ?? '', x + 20, y + 112);

  // Two columns inside card: Trial Formats (left) + Schedule & Commission (right)
  const leftW = Math.floor(w * 0.56);
  const rightX = x + leftW + 24;
  const rightW = w - leftW - 44;

  ctx.fillStyle = '#64748B';
  ctx.font = `700 12px ${fontSans}`;
  ctx.fillText('ОЧНЫЕ ИСПЫТАНИЯ И ПРОГРАММА ПРОВЕРКИ', x + 20, y + 146);

  let fy = y + 170;
  ctx.font = `400 13.5px ${fontSans}`;
  for (const format of loc.trialFormats.slice(0, 3)) {
    ctx.fillStyle = '#0F766E';
    ctx.fillText('•', x + 20, fy);
    ctx.fillStyle = '#1E293B';
    const lines = wrapText(ctx, format, leftW - 36, 2);
    for (const line of lines) {
      ctx.fillText(line, x + 34, fy);
      fy += 18;
    }
    fy += 4;
  }

  // Right info box
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.2;
  drawRoundedRect(ctx, rightX, y + 132, rightW, 152, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = `700 11.5px ${fontSans}`;
  ctx.fillText('БЛИЖАЙШИЕ СЕССИИ 2027', rightX + 14, y + 156);
  ctx.fillStyle = '#0F172A';
  ctx.font = `600 13.5px ${fontMono}`;
  const sessionLines = wrapText(ctx, loc.nextSessions, rightW - 28, 2);
  sessionLines.forEach((line, i) => {
    ctx.fillText(line, rightX + 14, y + 176 + i * 17);
  });

  ctx.fillStyle = '#64748B';
  ctx.font = `700 11.5px ${fontSans}`;
  ctx.fillText('КУРАТОРЫ КОМИССИИ', rightX + 14, y + 220);
  ctx.fillStyle = '#0F172A';
  ctx.font = `600 13.5px ${fontSans}`;
  const chairLines = wrapText(ctx, loc.chairName, rightW - 28, 1);
  ctx.fillText(chairLines[0] ?? loc.chairName, rightX + 14, y + 240);

  ctx.fillStyle = '#475569';
  ctx.font = `400 12.5px ${fontSans}`;
  const capLines = wrapText(ctx, loc.capacityNote, rightW - 28, 2);
  capLines.forEach((line, i) => {
    ctx.fillText(line, rightX + 14, y + 263 + i * 16);
  });

  // Bottom bar of card
  ctx.strokeStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 304);
  ctx.lineTo(x + w - 20, y + 304);
  ctx.stroke();

  ctx.fillStyle = '#0F766E';
  ctx.font = `600 13px ${fontSans}`;
  const discLine = wrapText(ctx, `Дисциплины: ${loc.disciplines.join(', ')}`, w - 40, 1);
  ctx.fillText(discLine[0] ?? '', x + 20, y + 328);

  ctx.fillStyle = '#64748B';
  ctx.font = `400 12.5px ${fontSans}`;
  const protoLine = wrapText(ctx, `Основание: ${loc.protocolNote}`, w - 40, 1);
  ctx.fillText(protoLine[0] ?? '', x + 20, y + 349);

  return cardH;
}

export async function exportAttestationLocationsPdf(
  options: AttestationLocationsExportOptions
): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('Экспорт PDF доступен только в браузере.');
  }
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const model = buildAttestationLocationsPdfModel(options);
  const fileName = `${model.fileNameBase}.pdf`;

  const W = 1240;
  const H = 1754;
  const padX = 56;
  const contentW = W - padX * 2;
  const fontSans =
    '"Plus Jakarta Sans", "DejaVu Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const fontMono = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });
  const pdfW = doc.internal.pageSize.getWidth();
  const pdfH = doc.internal.pageSize.getHeight();

  let runningIndex = 1;

  model.pages.forEach((pageVenues, pageIdx) => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Не удалось инициализировать графический контекст для PDF.');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    let y = 0;
    if (pageIdx === 0) {
      // Full official header on Page 1
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, W, 184);

      ctx.fillStyle = '#5EEAD4';
      ctx.font = `600 16px ${fontSans}`;
      ctx.fillText('РЦА «РУССКИЙ ВОСТОК» · ВВГУ · ФСТР · АТТЕСТАЦИОННАЯ КОМИССИЯ ДФО', padX, 48);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 29px ${fontSans}`;
      ctx.fillText('Реестр аттестованных площадок ДФО для комиссий', padX, 94);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = `400 15px ${fontSans}`;
      ctx.fillText(
        `Документ № ${model.documentNumber}  ·  Сформирован: ${model.generatedAtLabel}`,
        padX,
        130
      );

      ctx.fillStyle = '#94A3B8';
      ctx.font = `500 14px ${fontSans}`;
      const filterLine = wrapText(ctx, model.filterSummary, contentW, 1);
      ctx.fillText(filterLine[0] ?? model.filterSummary, padX, 160);

      // KPI Strip
      const kpiY = 204;
      const kpiGap = 18;
      const kpiW = (contentW - kpiGap * 3) / 4;
      const kpiH = 92;
      const kpis = [
        { label: 'Площадок в выгрузке', value: String(model.totalVenues), color: '#0F766E' },
        { label: 'Субъектов ДФО', value: String(model.regionsCount), color: '#0F172A' },
        { label: 'Полевых полигонов', value: String(model.fieldPolygonsCount), color: '#B45309' },
        {
          label: 'Центр / выездные точки',
          value: `${model.headquartersCount} / ${model.regionalHubsCount}`,
          color: '#0369A1',
        },
      ];

      kpis.forEach((kpi, idx) => {
        const kx = padX + idx * (kpiW + kpiGap);
        ctx.fillStyle = '#F8FAFC';
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1.5;
        drawRoundedRect(ctx, kx, kpiY, kpiW, kpiH, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#64748B';
        ctx.font = `600 13px ${fontSans}`;
        ctx.fillText(kpi.label, kx + 16, kpiY + 30);

        ctx.fillStyle = kpi.color;
        ctx.font = `700 26px ${fontMono}`;
        ctx.fillText(kpi.value, kx + 16, kpiY + 70);
      });

      y = 320;
    } else {
      // Compact continuation header on pages 2+
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, W, 94);

      ctx.fillStyle = '#5EEAD4';
      ctx.font = `600 14px ${fontSans}`;
      ctx.fillText('РЕЕСТР АТТЕСТОВАННЫХ ПЛОЩАДОК ДФО · ПРОДОЛЖЕНИЕ', padX, 38);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = `400 14px ${fontSans}`;
      ctx.fillText(
        `Документ № ${model.documentNumber}  ·  ${model.filterSummary}`,
        padX,
        68
      );
      y = 122;
    }

    for (const loc of pageVenues) {
      const cardH = drawVenueCard(ctx, loc, runningIndex, padX, y, contentW, fontSans, fontMono);
      runningIndex += 1;
      y += cardH + 22;
    }

    // Commission approval / sign-off box on final page
    const isLastPage = pageIdx === model.pages.length - 1;
    if (isLastPage) {
      const signY = Math.max(y + 8, H - 230);
      ctx.fillStyle = '#F0FDFA';
      ctx.strokeStyle = '#99F6E4';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, padX, signY, contentW, 134, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0F766E';
      ctx.font = `700 15px ${fontSans}`;
      ctx.fillText('ДЛЯ РАБОТЫ АТТЕСТАЦИОННОЙ КОМИССИИ РЦА «РУССКИЙ ВОСТОК» (ВВГУ · ФСТР)', padX + 20, signY + 34);

      ctx.fillStyle = '#1E293B';
      ctx.font = `400 13.5px ${fontSans}`;
      ctx.fillText(
        'Выписка подготовлена для сверки адресов проведения экзаменов, допуска групп на полевые полигоны и оформления протоколов (ПП РФ № 1003, № 1893).',
        padX + 20,
        signY + 62
      );

      ctx.fillStyle = '#0F172A';
      ctx.font = `600 14px ${fontSans}`;
      ctx.fillText('Председатель комиссии: ______________________ / ________________ /', padX + 20, signY + 104);
      ctx.fillText('Секретарь комиссии: ______________________ / ________________ /', padX + 600, signY + 104);
    }

    // Footer
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, H - 68);
    ctx.lineTo(W - padX, H - 68);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = `500 13px ${fontSans}`;
    ctx.fillText('РЦА «Русский Восток» · Портал rca-vostok.ru · Формат А4 для комиссий ДФО', padX, H - 36);

    ctx.textAlign = 'right';
    ctx.font = `500 13px ${fontMono}`;
    ctx.fillText(`Стр. ${pageIdx + 1} / ${model.pages.length}`, W - padX, H - 36);
    ctx.textAlign = 'left';

    const dataUrl = canvas.toDataURL('image/png', 0.96);
    if (pageIdx > 0) {
      doc.addPage('a4', 'portrait');
    }
    doc.addImage(dataUrl, 'PNG', 0, 0, pdfW, pdfH, undefined, 'FAST');
  });

  doc.save(fileName);
  return fileName;
}
