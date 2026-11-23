import { jsPDF } from 'jspdf';
import { DISSERTATION_DATA } from '../data/researchData.ts';

export type AcademicWorkCategory =
  | 'Диссертация'
  | 'Автореферат'
  | 'Статья ВАК'
  | 'Загруженный PDF';

export interface AcademicWorkSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface AcademicWorkDocument {
  id: string;
  title: string;
  subtitle: string;
  category: AcademicWorkCategory;
  specialtyCode: string;
  year: string;
  authors: string;
  abstract: string;
  fileName: string;
  sizeBytes: number;
  sizeLabel: string;
  source: 'built-in' | 'uploaded';
  uploadedAt?: string;
  sections?: AcademicWorkSection[];
  bytes?: Uint8Array;
}

export const MAX_ACADEMIC_PDF_BYTES = 50 * 1024 * 1024;
export const MIN_PDF_ZOOM = 0.6;
export const MAX_PDF_ZOOM = 2.2;
export const PDF_ZOOM_STEP = 0.15;

export function formatPdfFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 КБ';
  if (bytes < 1024) return `${Math.round(bytes)} Б`;
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1).replace('.', ',')} МБ`;
}

export function validateAcademicPdfFile(file: {
  name: string;
  type: string;
  size: number;
}): { valid: true } | { valid: false; error: string } {
  const lowerName = file.name.trim().toLowerCase();
  const isPdfMime =
    file.type === 'application/pdf' ||
    file.type === 'application/x-pdf' ||
    file.type === '';
  const hasPdfExtension = lowerName.endsWith('.pdf');

  if (!hasPdfExtension && file.type !== 'application/pdf') {
    return {
      valid: false,
      error: `Файл «${file.name}» не является PDF-документом. Поддерживается формат .pdf.`,
    };
  }
  if (!isPdfMime && !hasPdfExtension) {
    return {
      valid: false,
      error: `Неподдерживаемый MIME-тип для файла «${file.name}». Выберите файл PDF.`,
    };
  }
  if (file.size <= 0) {
    return {
      valid: false,
      error: `Файл «${file.name}» пуст (0 байт).`,
    };
  }
  if (file.size > MAX_ACADEMIC_PDF_BYTES) {
    return {
      valid: false,
      error: `Файл «${file.name}» превышает лимит 50 МБ (${formatPdfFileSize(file.size)}).`,
    };
  }
  return { valid: true };
}

export function clampPdfPage(page: number, totalPages: number): number {
  const safeTotal = Math.max(1, Math.floor(totalPages || 1));
  if (!Number.isFinite(page)) return 1;
  return Math.min(safeTotal, Math.max(1, Math.floor(page)));
}

export function stepPdfZoom(currentZoom: number, delta: number): number {
  const next = Math.round((currentZoom + delta) * 100) / 100;
  return Math.min(MAX_PDF_ZOOM, Math.max(MIN_PDF_ZOOM, next));
}

export function rotatePdfQuarterTurn(currentDeg: number): 0 | 90 | 180 | 270 {
  const normalized = ((Math.round(currentDeg / 90) * 90 + 90) % 360 + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
}

export function createUploadedAcademicWorkMeta(
  file: { name: string; size: number },
  bytes: Uint8Array,
  uploadedAtIso = new Date().toISOString().slice(0, 10)
): AcademicWorkDocument {
  const cleanTitle = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
  const id = `uploaded-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    title: cleanTitle || file.name,
    subtitle: `Загруженный пользователем PDF-документ · ${formatPdfFileSize(file.size)}`,
    category: 'Загруженный PDF',
    specialtyCode: 'Локальный файл',
    year: uploadedAtIso.slice(0, 4),
    authors: 'Загружено в рабочую библиотеку',
    abstract:
      'Документ загружен с устройства пользователя и отображается во встроенном PDF-ридере без передачи на сторонние ресурсы.',
    fileName: file.name,
    sizeBytes: file.size,
    sizeLabel: formatPdfFileSize(file.size),
    source: 'uploaded',
    uploadedAt: uploadedAtIso,
    bytes,
  };
}

export const BUILT_IN_ACADEMIC_WORKS: AcademicWorkDocument[] = [
  {
    id: 'diss-manuscript-2026',
    title: 'Кандидатская диссертация: обзор ключевых глав рукописи',
    subtitle: DISSERTATION_DATA.workingTitle,
    category: 'Диссертация',
    specialtyCode: 'ВАК 5.2.3 · 4.15',
    year: '2026',
    authors: 'Исследовательский коллектив ВВГУ / РЦА «Русский Восток»',
    abstract: DISSERTATION_DATA.aim,
    fileName: 'Dissertaciya_VAK_5_2_3_Rukovodstvo_Primorye_2026.pdf',
    sizeBytes: 384 * 1024,
    sizeLabel: '384 КБ',
    source: 'built-in',
    sections: [
      {
        heading: 'Паспорт исследования и методологический аппарат',
        paragraphs: [
          `Специальность: ${DISSERTATION_DATA.specialty} (${DISSERTATION_DATA.specialization}).`,
          `Рабочая тема: ${DISSERTATION_DATA.workingTitle}`,
          `Объект исследования: ${DISSERTATION_DATA.object}`,
          `Предмет исследования: ${DISSERTATION_DATA.subject}`,
          `Цель исследования: ${DISSERTATION_DATA.aim}`,
        ],
        bullets: DISSERTATION_DATA.tasks,
      },
      {
        heading: 'Глава 1. Институциональная природа кадрового дефицита и сравнение с IFMGA',
        paragraphs: [
          DISSERTATION_DATA.novelty[0].text,
          DISSERTATION_DATA.ifmgaBenchmark.ifmga,
          DISSERTATION_DATA.ifmgaBenchmark.russia,
          DISSERTATION_DATA.ifmgaBenchmark.insight,
        ],
      },
      {
        heading: 'Глава 2. Методика оценки «нелегализованного резерва» и разрыв по Приморью',
        paragraphs: [
          DISSERTATION_DATA.novelty[1].text,
          DISSERTATION_DATA.novelty[3].text,
          'Эмпирическая верификация на данных Приморского края (активный поток ≈ 835 тыс. туристов в год, сезон 7 месяцев, нормативная нагрузка 8–12 чел. на группу) подтверждает структурный разрыв более чем на порядок: 1 200–2 390 чел. расчётной потребности против 122 записей в Едином федеральном реестре.',
        ],
      },
      {
        heading: 'Глава 3. Механизм сопряжения ВВГУ — РЦА и положения на защиту',
        paragraphs: [
          DISSERTATION_DATA.novelty[2].text,
          'Практическое внедрение модели в контуре ДПО ВВГУ и Регионального центра аттестации «Русский Восток» снижает трансакционные издержки входа для действующих гидов за счёт зачёта практического стажа и подготовки к полевому этапу экзамена.',
        ],
        bullets: DISSERTATION_DATA.defensePropositions,
      },
    ],
  },
  {
    id: 'diss-autoreferat-2026',
    title: 'Автореферат диссертации (проект для диссовета ВАК 5.2.3)',
    subtitle: 'Общая характеристика работы, научная новизна и 4 положения, выносимые на защиту',
    category: 'Автореферат',
    specialtyCode: 'ВАК 5.2.3 · 4.15',
    year: '2026',
    authors: 'ВВГУ · Кафедра экономики и управления',
    abstract:
      'Краткое системное изложение актуальности, новизны, теоретической и практической значимости исследования для предварительной экспертизы в диссертационном совете.',
    fileName: 'Avtoreferat_VAK_5_2_3_Primorye_2026.pdf',
    sizeBytes: 248 * 1024,
    sizeLabel: '248 КБ',
    source: 'built-in',
    sections: [
      {
        heading: 'I. Общая характеристика диссертационной работы',
        paragraphs: [
          `Актуальность исследования определяется вступлением в силу Постановлений Правительства РФ № 1003 и № 1893 (дедлайн обязательной аттестации — 01.10.2026), сформировавших острый институциональный дефицит аттестованных инструкторов-проводников на Дальнем Востоке.`,
          `Цель: ${DISSERTATION_DATA.aim}`,
        ],
        bullets: DISSERTATION_DATA.vakComparison.map(
          (row) => `${row.criterion}: ${row.candidate}`
        ),
      },
      {
        heading: 'II. Научная новизна результатов исследования',
        paragraphs: DISSERTATION_DATA.novelty.map(
          (item) => `${item.num}. ${item.title}. ${item.text}`
        ),
      },
      {
        heading: 'III. Положения, выносимые на защиту, и апробация',
        paragraphs: [
          'Основные результаты исследования доложены на Тихоокеанском международном туристском конгрессе (ВВГУ), профильных региональных совещаниях Минтуризма Приморского края и методических семинарах РЦА «Русский Восток».',
        ],
        bullets: DISSERTATION_DATA.defensePropositions,
      },
    ],
  },
  {
    id: 'vak-article-1',
    title: 'Статья ВАК (К-1/К-2) № 1: Институциональная природа кадрового дефицита',
    subtitle: DISSERTATION_DATA.publicationsPlan[0].topic,
    category: 'Статья ВАК',
    specialtyCode: 'ВАК К-1/К-2',
    year: '2026',
    authors: 'Журнал «Экономика и управление в сфере услуг» (рукопись)',
    abstract:
      'Обоснование разграничения физического и легализационного дефицита инструкторов-проводников в регулируемом сегменте туризма Дальневосточного федерального округа.',
    fileName: 'Statya_VAK_1_Institucionalny_Deficit_DFO.pdf',
    sizeBytes: 176 * 1024,
    sizeLabel: '176 КБ',
    source: 'built-in',
    sections: [
      {
        heading: 'Аннотация и постановка научной проблемы',
        paragraphs: [
          'В статье рассматривается трансформация рынка услуг инструкторов-проводников ДФО после перехода к обязательной федеральной аттестации. Показано, что наблюдаемая нехватка кадров в реестре отражает не столько демографический провал, сколько высокий институциональный барьер легализации для действующих практиков.',
          DISSERTATION_DATA.novelty[0].text,
        ],
      },
      {
        heading: 'Эмпирические сопоставления по субъектам ДФО',
        paragraphs: [
          'Сравнение Камчатского края (343 записи в реестре при потребности ≈ 920 чел.) и Приморского края (122 записи при потребности 2 390 чел.) демонстрирует асимметрию готовности региональных рынков к аттестации.',
          'Доля аттестованных в общем расчётном спросе по регионам ДФО составляет от 22% до 37%, что требует дифференцированных механизмов допуска и выездных комиссий.',
        ],
      },
    ],
  },
  {
    id: 'vak-article-2',
    title: 'Статья ВАК № 2–3: Методика оценки резерва и модель ВВГУ — РЦА',
    subtitle: `${DISSERTATION_DATA.publicationsPlan[1].topic} · кейс ВВГУ`,
    category: 'Статья ВАК',
    specialtyCode: 'ВАК 5.2.3',
    year: '2026',
    authors: 'Научный препринт ВВГУ / РЦА «Русский Восток»',
    abstract:
      'Математическая формализация «нелегализованного резерва» и описание организационно-экономического контура ДПО + аттестация с учётом 5-летнего цикла переаттестации.',
    fileName: 'Statya_VAK_2_3_Metodika_VVGU_RCA.pdf',
    sizeBytes: 192 * 1024,
    sizeLabel: '192 КБ',
    source: 'built-in',
    sections: [
      {
        heading: '1. Методика расчёта потребности с коэффициентом «теневого резерва»',
        paragraphs: [
          DISSERTATION_DATA.novelty[1].text,
          'Введение поправочного коэффициента легализации позволяет Минэкономразвития и образовательным центрам ДФО раздельно планировать быстрые интенсивы переподготовки действующих гидов (Контур А) и долгосрочную подготовку новых кадров из студенческих и спортивных клубов (Контур Б).',
        ],
      },
      {
        heading: '2. Организационно-экономический механизм сопряжения (кейс ВВГУ и РЦА)',
        paragraphs: [
          DISSERTATION_DATA.novelty[2].text,
          'Пятилетний цикл обязательной переаттестации переводит поток слушателей из разовой кампании 2026 года в устойчивый воспроизводимый контур для экономики регионального университета и туроператоров.',
        ],
        bullets: [
          'Модульная программа ДПО объёмом 250 академических часов с зачётом подтверждённого маршрутного стажа.',
          'Встроенный пробный полевой этап аттестации на полигонах Приморского края.',
          'Целевые договоры с туроператорами, компенсирующими 50–100% стоимости обучения при контракте на 2–3 сезона.',
        ],
      },
    ],
  },
];

const builtInPdfBytesCache = new Map<string, Uint8Array>();

function wrapAcademicLines(
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

export function buildBuiltInAcademicPdfBytes(work: AcademicWorkDocument): Uint8Array {
  const cached = builtInPdfBytesCache.get(work.id);
  if (cached) return cached;
  if (work.bytes) return work.bytes;

  // Render crisp 150 DPI A4 pages onto Canvas so Cyrillic serif/sans renders identically across all OS/browsers,
  // then assemble a genuine multi-page PDF binary with jsPDF.
  const W = 1240;
  const H = 1754;
  const marginX = 96;
  const contentW = W - marginX * 2;
  const topY = 120;
  const maxY = H - 120;

  const pages: HTMLCanvasElement[] = [];

  const createPage = (isFirst: boolean): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; y: number } => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Не удалось инициализировать Canvas 2D для рендеринга академического PDF.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Top accent bar & running institutional header
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(0, 0, W, 10);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px "DejaVu Sans", Arial, sans-serif';
    ctx.fillText(`ВВГУ · РЦА «Русский Восток» · ${work.specialtyCode}`, marginX, 62);
    ctx.textAlign = 'right';
    ctx.fillText(`${work.category} · ${work.year} г.`, W - marginX, 62);
    ctx.textAlign = 'left';

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(marginX, 78);
    ctx.lineTo(W - marginX, 78);
    ctx.stroke();

    let y = topY;

    if (isFirst) {
      // Title & subtitle block
      ctx.fillStyle = '#0f766e';
      ctx.font = 'bold 16px "DejaVu Sans", Arial, sans-serif';
      ctx.fillText(work.category.toUpperCase(), marginX, y);
      y += 38;

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 30px Georgia, "DejaVu Serif", serif';
      for (const line of wrapAcademicLines(ctx, work.title, contentW)) {
        ctx.fillText(line, marginX, y);
        y += 40;
      }

      y += 6;
      ctx.fillStyle = '#334155';
      ctx.font = 'italic 19px Georgia, "DejaVu Serif", serif';
      for (const line of wrapAcademicLines(ctx, work.subtitle, contentW)) {
        ctx.fillText(line, marginX, y);
        y += 28;
      }

      y += 14;
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      const abstractLines = wrapAcademicLines(ctx, work.abstract, contentW - 44);
      const boxH = 54 + abstractLines.length * 25;
      ctx.fillRect(marginX, y, contentW, boxH);
      ctx.strokeRect(marginX, y, contentW, boxH);

      ctx.fillStyle = '#0f766e';
      ctx.font = 'bold 14px "DejaVu Sans", Arial, sans-serif';
      ctx.fillText('АННОТАЦИЯ', marginX + 22, y + 28);

      ctx.fillStyle = '#334155';
      ctx.font = '16px Georgia, "DejaVu Serif", serif';
      let ay = y + 56;
      for (const line of abstractLines) {
        ctx.fillText(line, marginX + 22, ay);
        ay += 25;
      }
      y += boxH + 34;
    }

    pages.push(canvas);
    return { canvas, ctx, y };
  };

  let pageState = createPage(true);

  const ensureSpace = (neededHeight: number) => {
    if (pageState.y + neededHeight > maxY) {
      pageState = createPage(false);
    }
  };

  const sections = work.sections ?? [];
  for (const sec of sections) {
    ensureSpace(80);
    pageState.ctx.fillStyle = '#0f172a';
    pageState.ctx.font = 'bold 21px "DejaVu Sans", Arial, sans-serif';
    const headingLines = wrapAcademicLines(pageState.ctx, sec.heading, contentW);
    for (const hLine of headingLines) {
      pageState.ctx.fillText(hLine, marginX, pageState.y);
      pageState.y += 28;
    }
    pageState.ctx.strokeStyle = '#0f766e';
    pageState.ctx.lineWidth = 2;
    pageState.ctx.beginPath();
    pageState.ctx.moveTo(marginX, pageState.y - 12);
    pageState.ctx.lineTo(marginX + 120, pageState.y - 12);
    pageState.ctx.stroke();
    pageState.y += 12;

    for (const para of sec.paragraphs) {
      pageState.ctx.font = '17px Georgia, "DejaVu Serif", serif';
      const pLines = wrapAcademicLines(pageState.ctx, para, contentW);
      for (const pLine of pLines) {
        ensureSpace(28);
        pageState.ctx.fillStyle = '#1e293b';
        pageState.ctx.font = '17px Georgia, "DejaVu Serif", serif';
        pageState.ctx.fillText(pLine, marginX, pageState.y);
        pageState.y += 26;
      }
      pageState.y += 12;
    }

    if (sec.bullets && sec.bullets.length > 0) {
      sec.bullets.forEach((bullet, idx) => {
        pageState.ctx.font = '16px "DejaVu Sans", Arial, sans-serif';
        const bLines = wrapAcademicLines(pageState.ctx, bullet, contentW - 38);
        ensureSpace(bLines.length * 24 + 14);

        pageState.ctx.fillStyle = '#0f766e';
        pageState.ctx.font = 'bold 16px "DejaVu Sans", Arial, sans-serif';
        pageState.ctx.fillText(`${idx + 1}.`, marginX + 6, pageState.y);

        pageState.ctx.fillStyle = '#334155';
        pageState.ctx.font = '16px "DejaVu Sans", Arial, sans-serif';
        for (const bLine of bLines) {
          pageState.ctx.fillText(bLine, marginX + 36, pageState.y);
          pageState.y += 24;
        }
        pageState.y += 8;
      });
      pageState.y += 12;
    }
  }

  // Stamp consistent page footers
  const totalPages = pages.length;
  pages.forEach((canvas, idx) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(marginX, H - 78);
    ctx.lineTo(W - marginX, H - 78);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '14px "DejaVu Sans", Arial, sans-serif';
    ctx.fillText(work.authors, marginX, H - 48);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px "DejaVu Sans", Arial, sans-serif';
    ctx.fillText(`Стр. ${idx + 1} из ${totalPages}`, W - marginX, H - 48);
    ctx.textAlign = 'left';
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pages.forEach((canvas, idx) => {
    if (idx > 0) pdf.addPage('a4', 'portrait');
    const imgUrl = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  });

  const arrayBuffer = pdf.output('arraybuffer');
  const bytes = new Uint8Array(arrayBuffer);
  builtInPdfBytesCache.set(work.id, bytes);
  return bytes;
}

// IndexedDB storage for user-uploaded PDFs so large academic works persist locally without server size limits
const IDB_NAME = 'rca_vostok_dissertation_pdfs_v1';
const IDB_STORE = 'uploaded_works';

function openPdfDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function loadUploadedAcademicWorks(): Promise<AcademicWorkDocument[]> {
  const db = await openPdfDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = Array.isArray(req.result) ? (req.result as AcademicWorkDocument[]) : [];
        resolve(items);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function saveUploadedAcademicWork(doc: AcademicWorkDocument): Promise<void> {
  const db = await openPdfDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(doc);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function removeUploadedAcademicWork(id: string): Promise<void> {
  const db = await openPdfDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
