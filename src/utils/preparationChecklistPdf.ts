import { jsPDF } from 'jspdf';
import type { SessionUser } from './identityApi.ts';
import type { UserAttestationSummary } from '../components/AttestationProgressWidget.tsx';
import type { InquiryRecord } from '../components/social/MyInquiriesSection.tsx';
import { formatRussianDate, type PreparationContour } from './personalRoadmap.ts';
import { wrapLines } from './pdfCanvasHelpers.ts';

export type HikeComplexityId = '1_ks' | '2_ks' | '3_ks' | '4_plus_ks';

export interface HikeComplexityMeta {
  id: HikeComplexityId;
  codeLabel: string;
  shortTitle: string;
  fullTitle: string;
  experienceRequirement: string;
  recommendedPrepWeeks: string;
  maxGroupSize: string;
  examFocus: string;
}

export const HIKE_COMPLEXITY_CATEGORIES: readonly HikeComplexityMeta[] = [
  {
    id: '1_ks',
    codeLabel: '1 КС',
    shortTitle: '1 категория сложности',
    fullTitle: '1 КС — маршруты начальной сложности (до 6–8 дней, базовый рельеф)',
    experienceRequirement: 'Участие в походах 1 КС или диплом ДПО ВВГУ 250 ч (Контур Б)',
    recommendedPrepWeeks: '3–4 недели подготовки',
    maxGroupSize: 'до 10–12 человек в группе',
    examFocus:
      'Базовое ориентирование, ПП РФ № 760, алгоритм вызова МЧС и первая помощь на маршруте.',
  },
  {
    id: '2_ks',
    codeLabel: '2 КС',
    shortTitle: '2 категория сложности',
    fullTitle: '2 КС — маршруты средней сложности (локальные препятствия 1А–1Б, таёжные зоны)',
    experienceRequirement: 'Подтверждённый опыт не ниже 1 КС + участие в маршрутах 2 КС',
    recommendedPrepWeeks: '4–6 недель подготовки',
    maxGroupSize: 'до 8–10 человек в группе',
    examFocus:
      'Организация переправ, страховка на сложном рельефе, автономная первая помощь (WFA) и ООПТ.',
  },
  {
    id: '3_ks',
    codeLabel: '3 КС',
    shortTitle: '3 категория сложности',
    fullTitle: '3 КС — маршруты повышенной сложности (длительная автономия, пороги/перевалы 2А)',
    experienceRequirement: 'Руководство 2 КС или подтверждённое участие в походах 3 КС',
    recommendedPrepWeeks: '6–8 недель подготовки',
    maxGroupSize: 'до 6–8 человек в группе',
    examFocus:
      'Спасательные работы малой группой, спутниковая связь, расчёт паводковых и лавинных рисков.',
  },
  {
    id: '4_plus_ks',
    codeLabel: '4+ КС',
    shortTitle: '4 и выше категория сложности',
    fullTitle: '4+ КС — сложные экспедиционные маршруты (высокая автономия, сложные препятствия)',
    experienceRequirement: 'Руководство маршрутами 3 КС, справки МКК и подтверждённый стаж',
    recommendedPrepWeeks: '8–10 недель подготовки',
    maxGroupSize: '4–6 человек (экспедиционный состав)',
    examFocus:
      'Комплексное руководство ПСР, эвакуационный план с авиа/МЧС, резервирование связи и навигации.',
  },
] as const;

export const CHECKLIST_DISCIPLINES = [
  'Пешеходный и горный туризм',
  'Водный туризм и сплавы',
  'Экспедиционный / ООПТ',
  'Спелеологический / комбинированный',
  'Автомобильный туризм ДФО',
] as const;

export interface ChecklistItemTemplate {
  id: string;
  sectionId: 'documents' | 'theory' | 'field' | 'gear';
  title: string;
  detail: string;
  priority: 'Обязательно' | 'Критично для КС' | 'Рекомендуется';
  minLevel: number; // 1 for 1_ks+, 2 for 2_ks+, 3 for 3_ks+, 4 for 4_plus_ks
  contours?: readonly PreparationContour[];
  disciplinesMatch?: RegExp;
}

export interface PreparationChecklistItem extends ChecklistItemTemplate {
  sectionTitle: string;
  checked: boolean;
}

export interface PreparationChecklistSection {
  id: 'documents' | 'theory' | 'field' | 'gear';
  number: string;
  title: string;
  items: PreparationChecklistItem[];
}

export interface PreparationChecklistBuildInput {
  user: SessionUser;
  complexityId: HikeComplexityId;
  discipline?: string;
  contour?: PreparationContour;
  checkedItemIds?: readonly string[];
  summary?: UserAttestationSummary;
  inquiries?: InquiryRecord[];
  now?: Date;
}

export interface PreparationChecklistData {
  checklistId: string;
  generatedAtIso: string;
  generatedAtFormatted: string;
  applicantName: string;
  applicantEmail: string;
  applicantRegion: string;
  applicantOrganisation: string;
  complexity: HikeComplexityMeta;
  discipline: string;
  contour: PreparationContour;
  contourLabel: string;
  sections: PreparationChecklistSection[];
  totalItems: number;
  checkedItems: number;
  readinessPercent: number;
  profileStagesNote: string;
}

export interface GeneratedChecklistPdfResult {
  fileName: string;
  data: PreparationChecklistData;
  previewPagesDataUrls: string[];
  pdfBlobUrl: string;
}

const COMPLEXITY_LEVEL_ORDER: Record<HikeComplexityId, number> = {
  '1_ks': 1,
  '2_ks': 2,
  '3_ks': 3,
  '4_plus_ks': 4,
};

const SECTION_META: ReadonlyArray<{
  id: ChecklistItemTemplate['sectionId'];
  number: string;
  title: string;
}> = [
  { id: 'documents', number: '01', title: 'Документы и подтверждение стажа' },
  { id: 'theory', number: '02', title: 'Нормативная база и паспорт маршрута' },
  { id: 'field', number: '03', title: 'Полевые испытания, ПСР и первая помощь' },
  { id: 'gear', number: '04', title: 'Групповое снаряжение, связь и навигация' },
];

const BASE_CHECKLIST_ITEMS: readonly ChecklistItemTemplate[] = [
  // 01. Documents
  {
    id: 'doc_passport_snils',
    sectionId: 'documents',
    title: 'Паспорт РФ, СНИЛС и согласие на внесение в Единый федеральный реестр',
    detail: 'Сканы в хорошем качестве для анкеты соискателя РЦА «Русский Восток».',
    priority: 'Обязательно',
    minLevel: 1,
  },
  {
    id: 'doc_medical',
    sectionId: 'documents',
    title: 'Медицинское заключение об отсутствии противопоказаний к активным нагрузкам',
    detail: 'Действующая справка установленного образца (не старше 6 месяцев на дату сессии).',
    priority: 'Обязательно',
    minLevel: 1,
  },
  {
    id: 'doc_contour_b_dpo',
    sectionId: 'documents',
    title: 'Документ об образовании / удостоверение ДПО ВВГУ (250 ч)',
    detail: 'Для Контура Б: итоговый зачёт учебной программы и ведомость кафедры туризма ВВГУ.',
    priority: 'Обязательно',
    minLevel: 1,
    contours: ['contour_b'],
  },
  {
    id: 'doc_contour_a_exp',
    sectionId: 'documents',
    title: 'Подтверждение походного стажа (маршрутные книжки, справки МКК или договоры)',
    detail: 'Для Контура А: документальный ценз руководства и участия в маршрутах до выбранной КС.',
    priority: 'Критично для КС',
    minLevel: 1,
    contours: ['contour_a'],
  },
  {
    id: 'doc_mkk_2ks',
    sectionId: 'documents',
    title: 'Справки МКК / реестр выходов по маршрутам 1–2 КС с локальными препятствиями',
    detail: 'Подтверждение опыта прохождения переправ, траверсов и ночёвок в полевых условиях.',
    priority: 'Критично для КС',
    minLevel: 2,
  },
  {
    id: 'doc_mkk_3ks',
    sectionId: 'documents',
    title: 'Подтверждение опыта руководства 2 КС или участия в маршрутах 3 КС',
    detail: 'Заверенные отчёты о походах, GPS-треки и характеристики туроператора / ФСТР.',
    priority: 'Критично для КС',
    minLevel: 3,
  },
  {
    id: 'doc_mkk_4ks',
    sectionId: 'documents',
    title: 'Экспедиционное портфолио: руководство 3 КС и опыт автономных маршрутов ДФО',
    detail: 'Полный комплект протоколов МКК, справок о безаварийном сопровождении и рекомендаций.',
    priority: 'Критично для КС',
    minLevel: 4,
  },

  // 02. Theory & Route Passport
  {
    id: 'thr_law_1003',
    sectionId: 'theory',
    title: 'Разбор ФЗ № 132-ФЗ, ПП РФ № 1003 (в ред. № 1893) и полномочий инструктора',
    detail: 'Ответственность руководителя группы, границы допуска по КС и правила аттестации.',
    priority: 'Обязательно',
    minLevel: 1,
  },
  {
    id: 'thr_passport_760',
    sectionId: 'theory',
    title: 'Подготовка паспорта маршрута по форме ПП РФ № 760 для защиты на комиссии',
    detail: 'Нитка маршрута, расчёт дневных переходов, опасные участки, точки связи и запасные выходы.',
    priority: 'Обязательно',
    minLevel: 1,
  },
  {
    id: 'thr_mchs_notice',
    sectionId: 'theory',
    title: 'Регламент уведомления ГУ МЧС России и согласования с дирекциями ООПТ',
    detail: 'Регистрация группы не позднее чем за 10 рабочих дней до старта и расчёт рекреационной ёмкости.',
    priority: 'Обязательно',
    minLevel: 1,
  },
  {
    id: 'thr_risk_matrix_2ks',
    sectionId: 'theory',
    title: 'Матрица погодных, паводковых и биологических рисков (ДФО)',
    detail: 'План действий при резком ухудшении видимости, циклоне, паводке и встрече с дикими животными.',
    priority: 'Критично для КС',
    minLevel: 2,
  },
  {
    id: 'thr_autonomy_plan_3ks',
    sectionId: 'theory',
    title: 'График резервных дней, аварийной эвакуации и радиосвязи на автономном участке',
    detail: 'Подробные раскладки времени преодоления определяющих препятствий и лимиты схода группы.',
    priority: 'Критично для КС',
    minLevel: 3,
  },
  {
    id: 'thr_expedition_evac_4ks',
    sectionId: 'theory',
    title: 'Схема межведомственной эвакуации (МЧС / вертолётные площадки / точки сброса)',
    detail: 'Координаты площадок подбора, запасные маршруты вывода без связи и расчёт автономности 7+ дней.',
    priority: 'Критично для КС',
    minLevel: 4,
  },

  // 03. Field & Safety
  {
    id: 'fld_wfa_basic',
    sectionId: 'field',
    title: 'Практика автономной первой помощи (Wilderness First Aid)',
    detail: 'Остановка кровотечений, иммобилизация, профилактика переохлаждения и теплового удара.',
    priority: 'Обязательно',
    minLevel: 1,
  },
  {
    id: 'fld_orientation',
    sectionId: 'field',
    title: 'Ориентирование на местности по карте, компасу и офлайн-треку',
    detail: 'Определение точки стояния, чтение горизонталей и движение по азимуту в условиях тумана.',
    priority: 'Обязательно',
    minLevel: 1,
  },
  {
    id: 'fld_water_throw',
    sectionId: 'field',
    title: 'Отработка спасброска («морковка»), самосплава и страховки на воде',
    detail: 'Практический зачёт для водных и комбинированных направлений на полигоне.',
    priority: 'Критично для КС',
    minLevel: 1,
    disciplinesMatch: /вод|сплав|комбинир/i,
  },
  {
    id: 'fld_crossing_2ks',
    sectionId: 'field',
    title: 'Организация навесной и бродной переправы, страховка на крутых склонах',
    detail: 'Вязка базовых узлов, организация перил, сопровождение неподготовленных участников.',
    priority: 'Критично для КС',
    minLevel: 2,
  },
  {
    id: 'fld_psr_3ks',
    sectionId: 'field',
    title: 'Проведение ПСР силами малой группы и транспортировка условно пострадавшего',
    detail: 'Вязка носилок из подручного снаряжения, полиспасты и тактика спасработ на сложном рельефе.',
    priority: 'Критично для КС',
    minLevel: 3,
  },
  {
    id: 'fld_hypothermia_trauma_4ks',
    sectionId: 'field',
    title: 'Расширенный протокол длительного ухода за пострадавшим до эвакуации (24+ ч)',
    detail: 'Мониторинг жизненных показателей, защита от гипотермии и ротация дежурств в экспедиции.',
    priority: 'Критично для КС',
    minLevel: 4,
  },

  // 04. Gear & Comms
  {
    id: 'gear_personal_kit',
    sectionId: 'gear',
    title: 'Личный комплект снаряжения для полевой аттестации на полигоне',
    detail: 'Треккинговая обувь, штормовая защита, термоизоляция, налобный фонарь, запас батарей.',
    priority: 'Обязательно',
    minLevel: 1,
  },
  {
    id: 'gear_first_aid_kit',
    sectionId: 'gear',
    title: 'Групповая походная аптечка по регламенту РЦА и термоодеяла',
    detail: 'Проверка сроков годности перевязочных средств, жгутов, антисептиков и шин.',
    priority: 'Обязательно',
    minLevel: 1,
  },
  {
    id: 'gear_vhf_nav_2ks',
    sectionId: 'gear',
    title: 'УКВ-радиостанции для связи в группе, свистки и дублирующие офлайн-карты',
    detail: 'Заряженный пауэрбанк в гермоупаковке, бумажная топокарта с нанесёнными точками выхода.',
    priority: 'Критично для КС',
    minLevel: 2,
  },
  {
    id: 'gear_sat_tracker_3ks',
    sectionId: 'gear',
    title: 'Спутниковый трекер / коммуникатор (Garmin inReach / Иридиум) и ремнабор',
    detail: 'Проверка активного тарифа, тестового сообщения на КСС и комплектности групповой страховки.',
    priority: 'Критично для КС',
    minLevel: 3,
  },
  {
    id: 'gear_expedition_reserve_4ks',
    sectionId: 'gear',
    title: 'Резервная спутниковая связь, аварийный запас питания и групповой бивак',
    detail: 'Двойное резервирование навигации, групповой тент/штормовой мешок на весь экспедиционный состав.',
    priority: 'Критично для КС',
    minLevel: 4,
  },
];

export function resolveComplexityMeta(id: HikeComplexityId): HikeComplexityMeta {
  return (
    HIKE_COMPLEXITY_CATEGORIES.find((item) => item.id === id) ??
    HIKE_COMPLEXITY_CATEGORIES[1]
  );
}

export function inferInitialComplexityFromInquiries(
  inquiries: readonly InquiryRecord[] = []
): HikeComplexityId {
  const joined = inquiries.map((i) => `${i.track} ${i.experienceNote}`).join(' ');
  if (/4\s*КС|4\+|экспедиц/i.test(joined)) return '4_plus_ks';
  if (/3\s*КС/i.test(joined)) return '3_ks';
  if (/2\s*КС/i.test(joined)) return '2_ks';
  if (/1\s*КС/i.test(joined)) return '1_ks';
  return '2_ks';
}

export function buildPreparationChecklistData({
  user,
  complexityId,
  discipline = CHECKLIST_DISCIPLINES[0],
  contour = 'contour_b',
  checkedItemIds = [],
  summary,
  now = new Date(),
}: PreparationChecklistBuildInput): PreparationChecklistData {
  const complexity = resolveComplexityMeta(complexityId);
  const selectedLevel = COMPLEXITY_LEVEL_ORDER[complexityId];
  const checkedSet = new Set(checkedItemIds);

  const filteredTemplates = BASE_CHECKLIST_ITEMS.filter((tpl) => {
    if (tpl.minLevel > selectedLevel) return false;
    if (tpl.contours && !tpl.contours.includes(contour)) return false;
    if (tpl.disciplinesMatch && !tpl.disciplinesMatch.test(discipline)) return false;
    return true;
  });

  const sections: PreparationChecklistSection[] = SECTION_META.map((sec) => {
    const items = filteredTemplates
      .filter((tpl) => tpl.sectionId === sec.id)
      .map((tpl) => ({
        ...tpl,
        sectionTitle: sec.title,
        checked: checkedSet.has(tpl.id),
      }));
    return {
      ...sec,
      items,
    };
  }).filter((sec) => sec.items.length > 0);

  const allItems = sections.flatMap((s) => s.items);
  const totalItems = allItems.length;
  const checkedItems = allItems.filter((item) => item.checked).length;
  const readinessPercent =
    totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  const generatedAtIso = now.toISOString().slice(0, 10);
  const checklistId = `CHK-${complexity.codeLabel.replace(/[^0-9A-Z]/gi, '')}-${now
    .toISOString()
    .slice(2, 10)
    .replace(/-/g, '')}`;

  const contourLabel =
    contour === 'contour_a'
      ? 'Контур А · подтверждение походного стажа'
      : 'Контур Б · обучение по программе ДПО ВВГУ';

  const profileStagesNote = summary
    ? `Текущий прогресс в кабинете: ${summary.completedTasks}/${summary.totalTasks} шагов (${summary.percent}%)`
    : 'Прогресс привязан к личному кабинету соискателя';

  return {
    checklistId,
    generatedAtIso,
    generatedAtFormatted: formatRussianDate(generatedAtIso),
    applicantName: user.fullName,
    applicantEmail: user.email,
    applicantRegion: user.region || 'Приморский край',
    applicantOrganisation: user.organisation || 'Индивидуальный соискатель',
    complexity,
    discipline,
    contour,
    contourLabel,
    sections,
    totalItems,
    checkedItems,
    readinessPercent,
    profileStagesNote,
  };
}

function createA4Canvas(pageNumber: number, totalPages: number, data: PreparationChecklistData) {
  const W = 1654;
  const H = 2339;
  const marginX = 108;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось инициализировать графический контекст для PDF.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Subtle institutional border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  // Header strip
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(48, 48, W - 96, 108);

  ctx.fillStyle = '#ccfbf1';
  ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    'РЦА «РУССКИЙ ВОСТОК» · ВВГУ И ФСТР · ПЕРСОНАЛЬНЫЙ ЧЕК-ЛИСТ ПОДГОТОВКИ',
    marginX,
    92
  );

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `ЧЕК-ЛИСТ К АТТЕСТАЦИИ · ${data.complexity.codeLabel.toUpperCase()}`,
    marginX,
    134
  );

  ctx.textAlign = 'right';
  ctx.font = '18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillStyle = '#ccfbf1';
  ctx.fillText(`Стр. ${pageNumber} из ${totalPages}`, W - marginX, 132);
  ctx.textAlign = 'left';

  // Footer
  const footerY = H - 76;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX, footerY - 26);
  ctx.lineTo(W - marginX, footerY - 26);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(
    `Документ № ${data.checklistId} · Сформирован ${data.generatedAtFormatted} г. · ПП РФ № 1003 / № 760`,
    marginX,
    footerY
  );
  ctx.textAlign = 'right';
  ctx.fillText('rca-vostok.ru', W - marginX, footerY);
  ctx.textAlign = 'left';

  return { canvas, ctx, W, H, marginX, contentW: W - marginX * 2 };
}

function drawChecklistSection(
  ctx: CanvasRenderingContext2D,
  section: PreparationChecklistSection,
  marginX: number,
  contentW: number,
  startY: number
): number {
  let y = startY;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(marginX, y, contentW, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
  ctx.fillText(`${section.number}. ${section.title}`, marginX + 20, y + 29);

  y += 56;

  for (const item of section.items) {
    ctx.font = 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const titleLines = wrapLines(ctx, item.title, contentW - 260);
    ctx.font = '17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const detailLines = wrapLines(ctx, item.detail, contentW - 88);

    const cardH = Math.max(82, titleLines.length * 25 + detailLines.length * 23 + 34);

    ctx.fillStyle = item.checked ? '#f0fdf4' : '#ffffff';
    ctx.strokeStyle = item.checked ? '#86efac' : '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.fillRect(marginX, y, contentW, cardH);
    ctx.strokeRect(marginX, y, contentW, cardH);

    // Checkbox square
    const boxX = marginX + 20;
    const boxY = y + 22;
    ctx.fillStyle = item.checked ? '#047857' : '#ffffff';
    ctx.strokeStyle = item.checked ? '#047857' : '#64748b';
    ctx.lineWidth = 2;
    ctx.fillRect(boxX, boxY, 24, 24);
    ctx.strokeRect(boxX, boxY, 24, 24);

    if (item.checked) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(boxX + 5, boxY + 12);
      ctx.lineTo(boxX + 10, boxY + 18);
      ctx.lineTo(boxX + 19, boxY + 7);
      ctx.stroke();
    }

    // Priority label on top-right
    ctx.textAlign = 'right';
    ctx.fillStyle =
      item.priority === 'Критично для КС'
        ? '#b45309'
        : item.priority === 'Обязательно'
          ? '#0f766e'
          : '#475569';
    ctx.font = 'bold 15px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(item.priority.toUpperCase(), marginX + contentW - 20, y + 36);
    ctx.textAlign = 'left';

    // Title lines
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    let textY = y + 36;
    for (const line of titleLines) {
      ctx.fillText(line, marginX + 60, textY);
      textY += 25;
    }

    // Detail lines
    ctx.fillStyle = '#475569';
    ctx.font = '17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    textY += 4;
    for (const line of detailLines) {
      ctx.fillText(line, marginX + 60, textY);
      textY += 23;
    }

    y += cardH + 12;
  }

  return y + 18;
}

export async function generatePreparationChecklistPdf(
  data: PreparationChecklistData
): Promise<GeneratedChecklistPdfResult> {
  const firstHalfSections = data.sections.slice(0, 2);
  const secondHalfSections = data.sections.slice(2);
  const totalPages = secondHalfSections.length > 0 ? 2 : 1;

  // Page 1
  const page1 = createA4Canvas(1, totalPages, data);
  const { ctx, marginX, contentW } = page1;

  // Summary Profile & Complexity Box
  let y = 192;
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.8;
  ctx.fillRect(marginX, y, contentW, 276);
  ctx.strokeRect(marginX, y, contentW, 276);

  const metaRows: [string, string][] = [
    ['Соискатель:', `${data.applicantName} (${data.applicantEmail})`],
    ['Регион и организация:', `${data.applicantRegion} · ${data.applicantOrganisation}`],
    ['Категория сложности:', data.complexity.fullTitle],
    ['Направление и контур:', `${data.discipline} · ${data.contourLabel}`],
    ['Требуемый ценз и норма группы:', `${data.complexity.experienceRequirement} (${data.complexity.maxGroupSize})`],
    ['Готовность по чек-листу:', `Отмечено ${data.checkedItems} из ${data.totalItems} пунктов (${data.readinessPercent}%) · ${data.complexity.recommendedPrepWeeks}`],
  ];

  let ry = y + 40;
  for (const [label, value] of metaRows) {
    ctx.fillStyle = '#475569';
    ctx.font = '17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(label, marginX + 24, ry);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    ctx.fillText(value.slice(0, 88), marginX + 360, ry);
    ry += 40;
  }

  y += 304;
  for (const sec of firstHalfSections) {
    y = drawChecklistSection(ctx, sec, marginX, contentW, y);
  }

  const page1DataUrl = page1.canvas.toDataURL('image/png', 0.96);
  const previewPagesDataUrls = [page1DataUrl];

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  const pdfW = doc.internal.pageSize.getWidth();
  const pdfH = doc.internal.pageSize.getHeight();
  doc.addImage(page1DataUrl, 'PNG', 0, 0, pdfW, pdfH, undefined, 'FAST');

  if (secondHalfSections.length > 0) {
    const page2 = createA4Canvas(2, totalPages, data);
    let y2 = 192;
    for (const sec of secondHalfSections) {
      y2 = drawChecklistSection(page2.ctx, sec, page2.marginX, page2.contentW, y2);
    }

    // Exam Focus Note Box at bottom of page 2
    const focusY = Math.min(Math.max(y2 + 12, 1860), 2020);
    page2.ctx.fillStyle = '#f0fdfa';
    page2.ctx.strokeStyle = '#99f6e4';
    page2.ctx.lineWidth = 1.8;
    page2.ctx.fillRect(page2.marginX, focusY, page2.contentW, 134);
    page2.ctx.strokeRect(page2.marginX, focusY, page2.contentW, 134);

    page2.ctx.fillStyle = '#0f766e';
    page2.ctx.font = 'bold 19px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    page2.ctx.fillText(
      `Фокус экзаменационной комиссии РЦА для ${data.complexity.codeLabel}:`,
      page2.marginX + 24,
      focusY + 38
    );

    page2.ctx.fillStyle = '#1e293b';
    page2.ctx.font = '18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
    const focusLines = wrapLines(
      page2.ctx,
      `${data.complexity.examFocus} ${data.profileStagesNote}.`,
      page2.contentW - 48
    );
    let fy = focusY + 72;
    for (const line of focusLines.slice(0, 2)) {
      page2.ctx.fillText(line, page2.marginX + 24, fy);
      fy += 28;
    }

    const page2DataUrl = page2.canvas.toDataURL('image/png', 0.96);
    previewPagesDataUrls.push(page2DataUrl);
    doc.addPage('a4', 'portrait');
    doc.addImage(page2DataUrl, 'PNG', 0, 0, pdfW, pdfH, undefined, 'FAST');
  }

  const pdfBlob = doc.output('blob');
  const pdfBlobUrl = URL.createObjectURL(pdfBlob);
  const safeSlug = data.complexity.codeLabel.replace(/[^0-9A-Za-zА-Яа-я]+/g, '-').toLowerCase();
  const fileName = `checklist-rca-${safeSlug}-${data.generatedAtIso}.pdf`;

  return {
    fileName,
    data,
    previewPagesDataUrls,
    pdfBlobUrl,
  };
}
