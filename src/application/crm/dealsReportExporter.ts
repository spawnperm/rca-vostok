import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { DealItem, StageItem } from '../../presentation/types.ts';

export interface DealsReportContext {
  tenantName?: string;
  pipelineName: string;
  deals: DealItem[];
  stages: StageItem[];
  filtersSummary?: string;
  generatedBy?: string;
}

export interface DealsReportRow {
  index: number;
  title: string;
  stageName: string;
  budget: number;
  currency: string;
  winProbability: number | null;
  riskLevel: string;
  clientLabel: string;
  ownerName: string;
  openTasksCount: number;
  nextStep: string;
  updatedAtLabel: string;
}

export interface DealsStageSummaryRow {
  stageName: string;
  dealsCount: number;
  totalBudget: number;
  sharePct: number;
}

export interface DealsReportModel {
  generatedAtLabel: string;
  totalDeals: number;
  totalBudget: number;
  avgBudget: number;
  wonDealsCount: number;
  wonBudget: number;
  weightedForecast: number;
  rows: DealsReportRow[];
  stageSummary: DealsStageSummaryRow[];
}

export function buildDealsReportModel(ctx: DealsReportContext): DealsReportModel {
  const stageById = new Map(ctx.stages.map((s) => [s.id, s]));
  const wonStageIds = new Set(ctx.stages.filter((s) => s.isWon).map((s) => s.id));

  let totalBudget = 0;
  let wonDealsCount = 0;
  let wonBudget = 0;
  let weightedForecast = 0;

  const rows: DealsReportRow[] = ctx.deals.map((deal, idx) => {
    const stage = stageById.get(deal.stageId);
    const prob = deal.harnessAnalysis?.winProbability ?? null;
    totalBudget += deal.budget;
    if (wonStageIds.has(deal.stageId)) {
      wonDealsCount += 1;
      wonBudget += deal.budget;
    }
    weightedForecast += Math.round((deal.budget * (prob ?? 40)) / 100);

    const clientParts = [deal.companyName, deal.contactName].filter(Boolean);
    return {
      index: idx + 1,
      title: deal.title,
      stageName: stage?.name || '—',
      budget: deal.budget,
      currency: deal.currency || 'RUB',
      winProbability: prob,
      riskLevel: deal.harnessAnalysis?.riskLevel || '—',
      clientLabel: clientParts.length > 0 ? clientParts.join(' · ') : '—',
      ownerName: deal.ownerName || '—',
      openTasksCount: deal.openTasksCount ?? 0,
      nextStep: deal.harnessAnalysis?.nextStep?.title || '—',
      updatedAtLabel: new Date(deal.updatedAt).toLocaleDateString('ru-RU'),
    };
  });

  const stageSummary: DealsStageSummaryRow[] = ctx.stages.map((st) => {
    const stDeals = ctx.deals.filter((d) => d.stageId === st.id);
    const stBudget = stDeals.reduce((sum, d) => sum + d.budget, 0);
    return {
      stageName: st.name,
      dealsCount: stDeals.length,
      totalBudget: stBudget,
      sharePct: totalBudget > 0 ? Math.round((stBudget / totalBudget) * 100) : 0,
    };
  });

  return {
    generatedAtLabel: new Date().toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    totalDeals: ctx.deals.length,
    totalBudget,
    avgBudget: ctx.deals.length > 0 ? Math.round(totalBudget / ctx.deals.length) : 0,
    wonDealsCount,
    wonBudget,
    weightedForecast,
    rows,
    stageSummary,
  };
}

export function buildDealsXlsxWorkbook(ctx: DealsReportContext): XLSX.WorkBook {
  const model = buildDealsReportModel(ctx);
  const workbook = XLSX.utils.book_new();

  const headerMeta: Array<Array<string | number>> = [
    ['Отчёт по сделкам CRM', ctx.tenantName || 'NexusHarness CRM'],
    ['Воронка', ctx.pipelineName, 'Сформирован', model.generatedAtLabel],
    [
      'Всего сделок',
      model.totalDeals,
      'Общий бюджет (₽)',
      model.totalBudget,
      'Прогноз закрытия (₽)',
      model.weightedForecast,
    ],
  ];
  if (ctx.filtersSummary) {
    headerMeta.push(['Фильтры', ctx.filtersSummary]);
  }
  headerMeta.push([]);

  const tableHeaders = [
    '№',
    'Название сделки',
    'Этап воронки',
    'Бюджет',
    'Валюта',
    'Вероятность (%)',
    'Риск Harness',
    'Клиент / Компания',
    'Ответственный',
    'Открытые задачи',
    'Следующий шаг',
    'Обновлено',
  ];

  const tableRows: Array<Array<string | number>> = model.rows.map((r) => [
    r.index,
    r.title,
    r.stageName,
    r.budget,
    r.currency,
    r.winProbability ?? '—',
    r.riskLevel,
    r.clientLabel,
    r.ownerName,
    r.openTasksCount,
    r.nextStep,
    r.updatedAtLabel,
  ]);

  const dealsSheet = XLSX.utils.aoa_to_sheet([...headerMeta, tableHeaders, ...tableRows]);
  dealsSheet['!cols'] = [
    { wch: 5 },
    { wch: 36 },
    { wch: 24 },
    { wch: 16 },
    { wch: 9 },
    { wch: 15 },
    { wch: 14 },
    { wch: 28 },
    { wch: 22 },
    { wch: 15 },
    { wch: 34 },
    { wch: 14 },
  ];
  const headerRowIdx = headerMeta.length + 1;
  dealsSheet['!autofilter'] = {
    ref: `A${headerRowIdx}:L${headerRowIdx + Math.max(0, tableRows.length)}`,
  };
  XLSX.utils.book_append_sheet(workbook, dealsSheet, 'Сделки CRM');

  const summaryRows: Array<Array<string | number>> = [
    ['Сводка по этапам воронки', ctx.pipelineName],
    [],
    ['Этап воронки', 'Количество сделок', 'Сумма бюджета (₽)', 'Доля в бюджете (%)'],
    ...model.stageSummary.map((s) => [s.stageName, s.dealsCount, s.totalBudget, s.sharePct]),
    [],
    ['ИТОГО', model.totalDeals, model.totalBudget, 100],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 22 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Сводка по этапам');

  return workbook;
}

export function buildDealsXlsxBuffer(ctx: DealsReportContext): Uint8Array {
  const wb = buildDealsXlsxWorkbook(ctx);
  const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer | Uint8Array;
  return arr instanceof Uint8Array ? arr : new Uint8Array(arr);
}

export function exportDealsToXlsx(ctx: DealsReportContext): string {
  const bytes = buildDealsXlsxBuffer(ctx);
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `crm-deals-report-${dateStr}.xlsx`;
  const blob = new Blob([bytes.slice().buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBrowserDownload(blob, fileName);
  return fileName;
}

export interface PdfFontPair {
  regularBase64: string;
  boldBase64: string;
}

let cachedFontsPromise: Promise<PdfFontPair | null> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function loadCyrillicPdfFonts(): Promise<PdfFontPair | null> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return null;
  }
  if (!cachedFontsPromise) {
    cachedFontsPromise = (async () => {
      try {
        const [regRes, boldRes] = await Promise.all([
          fetch('/fonts/DejaVuSans.ttf'),
          fetch('/fonts/DejaVuSans-Bold.ttf'),
        ]);
        if (!regRes.ok || !boldRes.ok) return null;
        const [regBuf, boldBuf] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);
        return {
          regularBase64: arrayBufferToBase64(regBuf),
          boldBase64: arrayBufferToBase64(boldBuf),
        };
      } catch {
        return null;
      }
    })();
  }
  return cachedFontsPromise;
}

export function buildDealsPdfDocument(ctx: DealsReportContext, fonts?: PdfFontPair | null): jsPDF {
  const model = buildDealsReportModel(ctx);
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const hasCustomFont = Boolean(fonts?.regularBase64 && fonts?.boldBase64);
  if (hasCustomFont && fonts) {
    doc.addFileToVFS('DejaVuSans.ttf', fonts.regularBase64);
    doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
    doc.addFileToVFS('DejaVuSans-Bold.ttf', fonts.boldBase64);
    doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', 'bold');
    doc.setFont('DejaVuSans', 'normal');
  }

  const fontName = hasCustomFont ? 'DejaVuSans' : 'helvetica';

  // Header
  doc.setFillColor(24, 34, 50);
  doc.rect(0, 0, 297, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(14);
  doc.text(
    `Отчёт по сделкам CRM${ctx.tenantName ? ` — ${ctx.tenantName}` : ''}`,
    14,
    11
  );

  doc.setFont(fontName, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  const metaLine = [
    `Воронка: ${ctx.pipelineName}`,
    `Дата: ${model.generatedAtLabel}`,
    ctx.generatedBy ? `Автор: ${ctx.generatedBy}` : null,
    ctx.filtersSummary ? `Фильтры: ${ctx.filtersSummary}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');
  doc.text(metaLine, 14, 18.5);

  // KPI strip
  const kpis = [
    { label: 'Сделок в отчёте', value: String(model.totalDeals) },
    { label: 'Общий бюджет', value: `${model.totalBudget.toLocaleString('ru-RU')} ₽` },
    { label: 'Прогноз (Harness)', value: `${model.weightedForecast.toLocaleString('ru-RU')} ₽` },
    {
      label: 'Выиграно',
      value: `${model.wonDealsCount} · ${model.wonBudget.toLocaleString('ru-RU')} ₽`,
    },
  ];
  const cardWidth = 64;
  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * (cardWidth + 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, 29, cardWidth, 16, 2, 2, 'FD');
    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 3.5, 35);
    doc.setFont(fontName, 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, x + 3.5, 42);
  });

  // Main Deals Table
  autoTable(doc, {
    startY: 50,
    head: [
      [
        '№',
        'Название сделки',
        'Этап',
        'Бюджет',
        'Шанс',
        'Риск',
        'Клиент / Компания',
        'Менеджер',
        'Задачи',
        'Следующий шаг',
      ],
    ],
    body: model.rows.map((r) => [
      String(r.index),
      r.title,
      r.stageName,
      `${r.budget.toLocaleString('ru-RU')} ₽`,
      r.winProbability !== null ? `${r.winProbability}%` : '—',
      r.riskLevel,
      r.clientLabel,
      r.ownerName,
      String(r.openTasksCount),
      r.nextStep,
    ]),
    styles: {
      font: fontName,
      fontSize: 7.8,
      cellPadding: 2.3,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      font: fontName,
      fontStyle: 'bold',
      fillColor: [24, 34, 50],
      textColor: [255, 255, 255],
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 48 },
      2: { cellWidth: 30 },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 18 },
      6: { cellWidth: 40 },
      7: { cellWidth: 28 },
      8: { cellWidth: 14, halign: 'center' },
      9: { cellWidth: 42 },
    },
    margin: { left: 14, right: 14, bottom: 16 },
    didDrawPage: (hookData) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFont(fontName, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `NexusHarness CRM · Стр. ${hookData.pageNumber} из ${pageCount}`,
        14,
        203
      );
    },
  });

  return doc;
}

export async function exportDealsToPdf(ctx: DealsReportContext): Promise<string> {
  const fonts = await loadCyrillicPdfFonts();
  const doc = buildDealsPdfDocument(ctx, fonts);
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `crm-deals-report-${dateStr}.pdf`;
  doc.save(fileName);
  return fileName;
}

export interface DealContractExportInput {
  deal: DealItem;
  stageName: string;
  pipelineName: string;
  tenantName?: string;
  templateKind?: 'proposal' | 'contract' | 'sla';
}

export function buildDealContractPdfDocument(
  input: DealContractExportInput,
  fonts?: PdfFontPair | null
): jsPDF {
  const { deal, stageName, pipelineName, tenantName, templateKind = 'proposal' } = input;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const hasCustomFont = Boolean(fonts?.regularBase64 && fonts?.boldBase64);
  if (hasCustomFont && fonts) {
    doc.addFileToVFS('DejaVuSans.ttf', fonts.regularBase64);
    doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
    doc.addFileToVFS('DejaVuSans-Bold.ttf', fonts.boldBase64);
    doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', 'bold');
    doc.setFont('DejaVuSans', 'normal');
  }
  const fontName = hasCustomFont ? 'DejaVuSans' : 'helvetica';
  const pageWidth = doc.internal.pageSize.getWidth();
  const docNumber = `${
    templateKind === 'contract' ? 'ДОГ' : templateKind === 'sla' ? 'SLA' : 'КП'
  }-${deal.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;
  const docHeading =
    templateKind === 'contract'
      ? `Договор оказания услуг № ${docNumber}`
      : templateKind === 'sla'
      ? `Соглашение об уровне сервиса (SLA) № ${docNumber}`
      : `Коммерческое предложение № ${docNumber}`;

  doc.setFillColor(24, 34, 50);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(14);
  doc.text(tenantName || 'NexusHarness Enterprise', 14, 12);
  doc.setFont(fontName, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `${docHeading} · Дата: ${new Date().toLocaleDateString('ru-RU')}`,
    14,
    20
  );

  doc.setTextColor(15, 23, 42);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(13);
  doc.text(deal.title, 14, 40);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Воронка: ${pipelineName} · Текущий этап: ${stageName} · Приоритет: ${
      deal.customFields?.priority || 'Стандартный'
    }`,
    14,
    47
  );

  autoTable(doc, {
    startY: 54,
    head: [['Параметр сделки', 'Значение']],
    body: [
      ['Клиент / Компания', deal.companyName || 'Не указана'],
      ['Контактное лицо', [deal.contactName, deal.contactPhone].filter(Boolean).join(' · ') || '—'],
      ['Ответственный менеджер', deal.ownerName || '—'],
      [
        'Стоимость по сделке',
        `${deal.budget.toLocaleString('ru-RU')} ${deal.currency || 'RUB'}`,
      ],
      ['Текущий этап воронки', stageName],
      ['Открытых задач в работе', String(deal.openTasksCount ?? 0)],
      ['Теги классификации', deal.tags.length ? deal.tags.join(', ') : '—'],
    ],
    styles: {
      font: fontName,
      fontSize: 9,
      cellPadding: 3,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      font: fontName,
      fontStyle: 'bold',
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { cellWidth: 65, fontStyle: 'bold' },
      1: { cellWidth: 117 },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 130) + 12;

  doc.setFont(fontName, 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Ключевые условия и объём работ', 14, finalY);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(51, 65, 85);
  const termsText =
    templateKind === 'contract'
      ? `1. Исполнитель обязуется выполнить внедрение модулей платформы по проекту «${deal.title}» в согласованные сроки.\n2. Общая стоимость договора составляет ${deal.budget.toLocaleString('ru-RU')} ${deal.currency || 'RUB'}.\n3. Поддержка и мониторинг SLA осуществляются через выделенный контур NATS и портал сопровождения.`
      : templateKind === 'sla'
      ? `1. Целевая доступность сервисов (Uptime SLA): 99.9% в календарном месяце.\n2. Время первичной реакции на критический инцидент (Высокий приоритет): до 15 минут.\n3. Регулярное резервное копирование PostgreSQL и S3-объектов каждые 24 часа.`
      : `1. Коммерческое предложение сформировано автоматически из карточки сделки NexusHarness CRM.\n2. Фиксированный бюджет проекта: ${deal.budget.toLocaleString('ru-RU')} ${deal.currency || 'RUB'}.\n3. Следующий шаг: ${deal.harnessAnalysis?.nextStep?.title || 'Согласование спецификации и графика запуска'}.`;

  const lines = doc.splitTextToSize(termsText, pageWidth - 28);
  doc.text(lines, 14, finalY + 7);

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Ответственный со стороны Исполнителя: _____________________', 14, finalY + 42);
  doc.text('Представитель Заказчика: ___________________________________', 14, finalY + 51);

  return doc;
}

export async function exportDealContractPdf(input: DealContractExportInput): Promise<string> {
  const fonts = await loadCyrillicPdfFonts();
  const doc = buildDealContractPdfDocument(input, fonts);
  const safeId = input.deal.id.replace(/[^a-zA-Z0-9_-]/g, '');
  const prefix = input.templateKind || 'proposal';
  const fileName = `crm-${prefix}-${safeId}.pdf`;
  doc.save(fileName);
  return fileName;
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
