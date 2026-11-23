import {
  ATTESTATION_FAQ,
  ATTESTATION_TIMELINE_2025_2030,
  BOTTLENECKS,
  MARKET_SEGMENTS,
  type FaqItem,
} from '../data/researchData.ts';
import { CERTIFICATION_SCHEDULE, CONTACTS, formatSessionRange } from '../data/landingContent.ts';
import { METHODOLOGICAL_MATERIALS } from './accountKnowledgeBase.ts';
import { SECTION_SEO_MAP, type SiteTabId } from './seo.ts';

export interface RagChunk {
  id: string;
  sourceType: 'faq' | 'methodology' | 'section' | 'schedule' | 'timeline' | 'market';
  sourceLabel: string;
  title: string;
  content: string;
  tabs: SiteTabId[];
  tags: string[];
  faqId?: string;
}

export interface SectionRagSummary {
  tab: SiteTabId;
  sectionName: string;
  contextFocus: string;
  suggestedQuestions: readonly string[];
}

export interface FaqScenarioItem {
  id: string;
  faqId: string;
  group: 'procedure' | 'training' | 'region';
  groupLabel: string;
  prompt: string;
  answer: string;
  nextStepHint: string;
}

export interface FaqScenarioReply {
  answer: string;
  matchedFaq: FaqItem | null;
  sectionHint: string;
  relatedScenarios: FaqScenarioItem[];
  ragChunks: RagChunk[];
}

const SECTION_SPECIFIC_KNOWLEDGE: Record<
  SiteTabId,
  {
    contextFocus: string;
    facts: string;
    suggestedQuestions: readonly string[];
  }
> = {
  home: {
    contextFocus: 'Общая навигация по обучению, практике, графику 2027 и аттестации РЦА',
    facts:
      'Главная страница портала РЦА «Русский Восток» объединяет программы ДПО ВВГУ (пешеходный, водный туризм, экскурсовод), этапы подготовки, календарь сессий 2027, маршруты Приморья и контакты комиссии на ул. Гоголя, 41.',
    suggestedQuestions: [
      'Как подать документы на аттестацию в РЦА?',
      'Кто обязан пройти аттестацию по ПП № 1893?',
    ],
  },
  learning: {
    contextFocus: 'Программы профессионального обучения и ДПО ВВГУ (250 часов, водный туризм)',
    facts:
      'В разделе «Обучение» представлены программы ДПО на базе ВВГУ: переподготовка по пешеходному туризму (≈250 ч), водный туризм (10 мест, 27 200 ₽/год), экскурсовод и руководитель группы, с возможностью компенсации до 70% затрат.',
    suggestedQuestions: [
      'Сколько стоит обучение в ВВГУ и как получить субсидию 70%?',
      'Обязательно ли учиться в ВВГУ при наличии опыта походов?',
    ],
  },
  preparation: {
    contextFocus: 'Полевая практика, категорийные походы и подготовка к полигону',
    facts:
      'Подготовка включает теорию, отработку переправ, ПСР и спасработ на полигонах Шкотовского района (включая хр. Ливадийский), автономную первую помощь WFA и работу со спутниковой связью Garmin inReach.',
    suggestedQuestions: [
      'Что проверяют на полевых испытаниях в Шкотовском районе?',
      'Как зачесть опыт походов по Контуру А без МКК?',
    ],
  },
  certification: {
    contextFocus: 'График экзаменационных сессий на 2027 год (1–4 КС) и выдача бейджа',
    facts:
      'Сессии аттестации 1–4 КС по пешеходному, водному, горному и спелеологическому туризму проходят по графику 2027 года. Удостоверение действует 5 лет по всей РФ и вносится в Единый федеральный реестр МЭР РФ в течение 10 рабочих дней.',
    suggestedQuestions: [
      'На какой срок выдаётся аттестация и действует ли она по всей РФ?',
      'Что делать при несдаче теории или полевого этапа?',
    ],
  },
  consulting: {
    contextFocus: 'Паспортизация маршрутов по ПП № 760 и методический консалтинг',
    facts:
      'РЦА консультирует по разработке паспорта туристского маршрута (ПП № 760): картографическая нитка, нормирование таймингов, оценка рисков, рекреационная ёмкость, аварийные выходы и согласование с ООПТ.',
    suggestedQuestions: [
      'Что проверяют в паспорте маршрута по ПП № 760?',
      'Как исправить замечания комиссии в паспорте маршрута?',
    ],
  },
  news: {
    contextFocus: 'Нормативные обновления ПП № 1893, ПП № 1003 и итоги сессий РЦА',
    facts:
      'Ключевые нормативные вехи: 1 марта 2026 г. — вступление обновлённых правил ПП № 1893; 1 октября 2026 г. — обязательный дедлайн аттестации; в октябре 2026 г. треть соискателей РЦА прибыла из Хабаровска и Камчатки.',
    suggestedQuestions: [
      'С какого срока действуют правила ПП РФ № 1893?',
      'Сколько времени занимает получение нагрудной карточки-бейджа?',
    ],
  },
  routes: {
    contextFocus: 'Маршруты и 8 округов Приморского края (обеспеченность и безопасность)',
    facts:
      'Маршруты ДФО требуют протоколов безопасности при встрече с амурским тигром и бурым медведем (ООПТ «Земля леопарда», «Бикин», Сихотэ-Алинь), учёта паводков и спутникового трекинга.',
    suggestedQuestions: [
      'Какие требования безопасности ДФО проверяются на экзамене?',
      'Какие направления аттестации открыты сейчас?',
    ],
  },
  faq: {
    contextFocus: 'Официальный перечень частых вопросов (FAQ) по аттестации инструкторов',
    facts:
      'Раздел FAQ охватывает нормативные сроки, перечень документов (паспорт, СНИЛС, диплом/ДПО, медсправка, стаж, согласие ПДн), Контур А, раздельную пересдачу и продление удостоверения через 5 лет.',
    suggestedQuestions: [
      'Какие документы нужны для подачи заявки в РЦА?',
      'Как продлить удостоверение через 5 лет?',
    ],
  },
  contacts: {
    contextFocus: 'Адрес приёмной комиссии, телефон и контакты кураторов РЦА',
    facts: `Приёмная комиссия РЦА «Русский Восток» расположена по адресу: ${CONTACTS.address} (ИТКИ ВВГУ). Телефон: ${CONTACTS.phone}, e-mail: ${CONTACTS.email}. Руководитель центра — Григорий Саранча, председатель комиссии — Галина Гомилевская.`,
    suggestedQuestions: [
      'Где проходит аттестация и кто входит в комиссию?',
      'Сколько времени занимает проверка заявки комиссией?',
    ],
  },
  overview: {
    contextFocus: 'Обзор центра, дорожная карта 2025–2030, аккредитация и реестр ДФО',
    facts:
      'Дорожная карта 2025–2030 фиксирует рост реестра в Приморье (с 66 до 122 чел. при потребности 1 200–2 390 чел.), масштабирование Контура А, запуск водного и автомобильного треков и 5-летний цикл переаттестации к 2030 году.',
    suggestedQuestions: [
      'Каковы этапы развития аттестации в 2025–2030 гг.?',
      'Из каких шагов состоит экзамен в РЦА?',
    ],
  },
  calculator: {
    contextFocus: 'Экономико-математическая модель потребности N, сценарии до 2030 и калькулятор затрат',
    facts:
      'Модель расчёта потребности использует формулу N = ((T_act × P_org) / G_size / G_season) × K_season × K_turnover и сравнивает Консервативный (+4,5%/год), Базовый (+8,5%/год) и Оптимистичный (+13,5%/год) сценарии 2030, а также стоимость обучения и госпошлину.',
    suggestedQuestions: [
      'Как субсидия 70% влияет на стоимость обучения в ВВГУ?',
      'Почему модель ДФО учитывает 7-месячный сезон и текучесть?',
    ],
  },
  market: {
    contextFocus: 'Сегменты рынка ДФО, пять узких мест и сравнение регионов до 2030 г.',
    facts:
      'Рынок ДФО делится на массовые экотропы и глэмпинги Приморья, экспедиционные туры Камчатки/Сахалина и водные сплавы. Узкие места включают риск срыва сезона без реестровых гидов, теневой резерв и рост спроса к запуску курорта «Приморье» (2027) и Хасанского кластера (2028).',
    suggestedQuestions: [
      'Какие требования ДФО выше, чем в средней полосе РФ?',
      'Почему растёт спрос на водных и авто-инструкторов к 2028 году?',
    ],
  },
  dissertation: {
    contextFocus: 'Научное исследование ВАК 5.2.3 (область 4.15) и сравнение с IFMGA',
    facts:
      'Диссертационное исследование ВАК 5.2.3 обосновывает двухконтурную модель подготовки гидов (Контур А — зачёт опыта действующих гидов, Контур Б — базовая подготовка в ВВГУ) и сопоставляет российскую аттестацию со стандартами IFMGA.',
    suggestedQuestions: [
      'В чём суть двухконтурной модели (Контур А и Контур Б)?',
      'Как засчитывается практический опыт по Контуру А?',
    ],
  },
  presentations: {
    contextFocus: 'Слайды для защиты ВАК 5.2.3 и доклад для Минтуризма Приморского края',
    facts:
      'Раздел содержит 18 слайдов для учёного совета ВАК 5.2.3, управленческий доклад на 10 слайдов для Минтуризма Приморья и одностраничный раздаточный лист с ключевыми цифрами (122 в реестре vs 1 200–2 390 потребность).',
    suggestedQuestions: [
      'Какие ключевые цифры дефицита подтверждены по Приморью?',
      'Какие меры предлагаются для закрытия дефицита к 2030 году?',
    ],
  },
  analytics: {
    contextFocus: 'Реестр действующих аттестованных проводников ДФО, карты, прогнозы и SEO',
    facts:
      'В разделе «Аналитика» доступны KPI посещаемости, прогноз спроса по регионам ДФО до 2030, географическая карта маршрутов и интерактивный реестр действующих аттестованных проводников с фильтрацией по региону ДФО, специализации и сроку действия удостоверения (5 лет).',
    suggestedQuestions: [
      'Как фильтровать реестр действующих проводников и продлить удостоверение?',
      'На какой срок действует запись в Едином федеральном реестре?',
    ],
  },
  account: {
    contextFocus: 'Личный кабинет соискателя, самопроверка, календарь сессий, PDF-сертификат',
    facts:
      'В Личном кабинете соискатели отслеживают статус заявок, проходят самодиагностику, записываются на сессии аттестации 2027 года, заполняют цифровой паспорт инструктора и скачивают PDF-сертификат.',
    suggestedQuestions: [
      'Какие документы подготовить перед подачей заявки в кабинете?',
      'Как исправить замечания комиссии к заявке?',
    ],
  },
};

const EXTRA_CONSULTATION_FAQS: readonly FaqItem[] = [
  {
    id: 'faq-13',
    category: 'training',
    categoryLabel: 'Обучение и стоимость',
    question:
      'Какие квалификационные требования по образованию, здоровью и стажу предъявляются к соискателю?',
    answer:
      'Кандидат должен быть совершеннолетним гражданином РФ, иметь среднее профессиональное или высшее образование (либо пройти программу переподготовки ДПО ВВГУ ≈ 250 часов), медицинское заключение об отсутствии противопоказаний к активным маршрутам и подтверждённый опыт прохождения/руководства маршрутами 1–4 КС.',
  },
  {
    id: 'faq-14',
    category: 'procedure',
    categoryLabel: 'Процедура и сроки',
    question:
      'Как подать документы в РЦА и что делать при замечаниях комиссии в паспорте маршрута?',
    answer:
      'Заявка подаётся онлайн с комплектом скан-копий (паспорт, СНИЛС, диплом/ДПО, медсправка, стаж и проект паспорта маршрута по форме ПП № 760). Секретариат проверяет досье за 1–3 рабочих дня; при замечаниях заявка не аннулируется — правки можно дослать до начала сессии.',
  },
  {
    id: 'faq-15',
    category: 'procedure',
    categoryLabel: 'Процедура и сроки',
    question:
      'Как продлить удостоверение инструктора-проводника через 5 лет или открыть новую категорию?',
    answer:
      'За 60 дней до окончания 5-летнего срока действия записи в Едином федеральном реестре подаётся заявление на подтверждение квалификации и свежее медзаключение. Для новой категории сложности или нового вида туризма повторно сдавать общий правовой блок не требуется — защищается новый паспорт маршрута и профильная практика.',
  },
];

export const ALL_FAQ_SCENARIOS: readonly FaqScenarioItem[] = [
  ...ATTESTATION_FAQ,
  ...EXTRA_CONSULTATION_FAQS,
].map((faq) => {
  const nextStepHint =
    faq.category === 'training'
      ? 'Проверьте расчёт бюджета и субсидии в разделе «Калькулятор».'
      : faq.category === 'region'
      ? 'Сверьте требования по округам в разделе «Рынок ДФО» или «Маршруты».'
      : 'Сверьте даты ближайших сессий в разделе «Аттестация» или в Личном кабинете.';
  return {
    id: `scenario-${faq.id}`,
    faqId: faq.id,
    group: faq.category,
    groupLabel: faq.categoryLabel,
    prompt: faq.question,
    answer: faq.answer,
    nextStepHint,
  };
});

export function getSectionRagSummary(activeTab: SiteTabId): SectionRagSummary {
  const seo = SECTION_SEO_MAP[activeTab] ?? SECTION_SEO_MAP.home;
  const spec = SECTION_SPECIFIC_KNOWLEDGE[activeTab] ?? SECTION_SPECIFIC_KNOWLEDGE.home;
  return {
    tab: activeTab,
    sectionName: seo.name,
    contextFocus: spec.contextFocus,
    suggestedQuestions: spec.suggestedQuestions,
  };
}

function buildKnowledgeCorpus(): RagChunk[] {
  const chunks: RagChunk[] = [];

  for (const tabKey of Object.keys(SECTION_SPECIFIC_KNOWLEDGE) as SiteTabId[]) {
    const seo = SECTION_SEO_MAP[tabKey];
    const spec = SECTION_SPECIFIC_KNOWLEDGE[tabKey];
    chunks.push({
      id: `section-${tabKey}`,
      sourceType: 'section',
      sourceLabel: `Раздел «${seo.name}»`,
      title: seo.title,
      content: `${spec.contextFocus}. ${spec.facts}`,
      tabs: [tabKey],
      tags: seo.keywords.split(',').map((s) => s.trim()),
    });
  }

  for (const faq of [...ATTESTATION_FAQ, ...EXTRA_CONSULTATION_FAQS]) {
    const tabs: SiteTabId[] =
      faq.category === 'training'
        ? ['learning', 'calculator', 'dissertation', 'faq', 'account']
        : faq.category === 'region'
        ? ['market', 'routes', 'preparation', 'faq', 'analytics']
        : ['certification', 'consulting', 'overview', 'faq', 'account', 'analytics'];

    chunks.push({
      id: `rag-${faq.id}`,
      sourceType: 'faq',
      sourceLabel: `FAQ · ${faq.categoryLabel}`,
      title: faq.question,
      content: faq.answer,
      tabs,
      tags: [faq.categoryLabel],
      faqId: faq.id,
    });
  }

  for (const mat of METHODOLOGICAL_MATERIALS) {
    const mappedTabs: SiteTabId[] = ['overview', 'account', 'consulting', 'preparation'];
    if (mat.targetTab) mappedTabs.push(mat.targetTab);
    chunks.push({
      id: `rag-${mat.id}`,
      sourceType: 'methodology',
      sourceLabel: `${mat.code} · ${mat.normRef}`,
      title: mat.title,
      content: `${mat.summary} ${mat.keyPoints.join(' ')}`,
      tabs: mappedTabs,
      tags: [...mat.tags],
    });
  }

  for (const tl of ATTESTATION_TIMELINE_2025_2030) {
    chunks.push({
      id: `rag-${tl.id}`,
      sourceType: 'timeline',
      sourceLabel: `Этапы 2025–2030 · ${tl.period}`,
      title: `${tl.title} (${tl.phase})`,
      content: `${tl.summary} Ключевые задачи: ${tl.keyTasks.join('; ')}. Показатель: ${tl.checkpointMetric}.`,
      tabs: ['overview', 'calculator', 'market', 'news'],
      tags: ['таймлайн', '2030', tl.period, tl.phase],
    });
  }

  chunks.push({
    id: 'rag-schedule-2027',
    sourceType: 'schedule',
    sourceLabel: 'График сессий РЦА 2027',
    title: 'Расписание аттестационных сессий на 2027 год (1–4 КС)',
    content: CERTIFICATION_SCHEDULE.map(
      (s) => `${formatSessionRange(s.start, s.end)} — ${s.category}`
    ).join('; '),
    tabs: ['certification', 'home', 'account', 'overview'],
    tags: ['график', '2027', 'даты', 'сессии', 'КС'],
  });

  chunks.push({
    id: 'rag-market-segments-summary',
    sourceType: 'market',
    sourceLabel: 'Рынок ДФО · Сегменты и узкие места',
    title: 'Профили проводников и структурные риски ДФО',
    content: `${MARKET_SEGMENTS.map((s) => `${s.title} (${s.regionFocus}, ${s.groupNorm})`).join('; ')}. Узкие места: ${BOTTLENECKS.map((b) => b.title).join('; ')}.`,
    tabs: ['market', 'calculator', 'analytics', 'dissertation'],
    tags: ['рынок ДФО', 'сегменты', 'узкие места', 'Приморье', 'Камчатка'],
  });

  return chunks;
}

const KNOWLEDGE_CORPUS: readonly RagChunk[] = buildKnowledgeCorpus();

function tokenize(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .map((w) => (w.length > 5 ? w.slice(0, 5) : w));
}

function scoreTextOverlap(queryTokens: string[], targetText: string): number {
  if (queryTokens.length === 0) return 0;
  const normalizedTarget = targetText.toLowerCase().replace(/ё/g, 'е');
  let hits = 0;
  for (const token of queryTokens) {
    if (normalizedTarget.includes(token)) {
      hits += 1;
    }
  }
  return hits;
}

export function retrieveSectionRagContext(
  query: string,
  activeTab: SiteTabId,
  topK = 4
): {
  section: SectionRagSummary;
  chunks: RagChunk[];
  promptDigest: string[];
} {
  const section = getSectionRagSummary(activeTab);
  const queryTokens = tokenize(query);

  const scored = KNOWLEDGE_CORPUS.map((chunk) => {
    const isTabMatch = chunk.tabs.includes(activeTab);
    const titleScore = scoreTextOverlap(queryTokens, chunk.title) * 3;
    const tagScore = scoreTextOverlap(queryTokens, chunk.tags.join(' ')) * 2.5;
    const bodyScore = scoreTextOverlap(queryTokens, chunk.content) * 1.4;
    const sectionBoost =
      chunk.id === `section-${activeTab}`
        ? 4
        : isTabMatch
        ? 1.5
        : 0;

    const totalScore = titleScore + tagScore + bodyScore + sectionBoost;
    return { chunk, totalScore, isTabMatch };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);

  const selected = scored.slice(0, Math.max(1, topK)).map((item) => item.chunk);
  // Guarantee current section context is represented if not already included
  const currentSectionChunk = KNOWLEDGE_CORPUS.find((c) => c.id === `section-${activeTab}`);
  if (currentSectionChunk && !selected.some((c) => c.id === currentSectionChunk.id)) {
    selected.pop();
    selected.unshift(currentSectionChunk);
  }

  const promptDigest = selected.map(
    (c) => `[${c.sourceLabel}] ${c.title}: ${c.content}`
  );

  return {
    section,
    chunks: selected,
    promptDigest,
  };
}

export function matchFaqScenarioReply(
  queryOrScenarioId: string,
  activeTab: SiteTabId
): FaqScenarioReply {
  const section = getSectionRagSummary(activeTab);
  const exactScenario = ALL_FAQ_SCENARIOS.find(
    (s) => s.id === queryOrScenarioId || s.faqId === queryOrScenarioId
  );

  const allFaqs: readonly FaqItem[] = [...ATTESTATION_FAQ, ...EXTRA_CONSULTATION_FAQS];

  if (exactScenario) {
    const matchedFaq = allFaqs.find((f) => f.id === exactScenario.faqId) ?? null;
    const rag = retrieveSectionRagContext(exactScenario.prompt, activeTab, 3);
    const relatedScenarios = ALL_FAQ_SCENARIOS.filter(
      (s) => s.id !== exactScenario.id && s.group === exactScenario.group
    ).slice(0, 2);

    return {
      answer: `${exactScenario.answer}\n\nРекомендация (${section.sectionName}): ${exactScenario.nextStepHint}`,
      matchedFaq,
      sectionHint: `${section.sectionName} — ${section.contextFocus}`,
      relatedScenarios,
      ragChunks: rag.chunks,
    };
  }

  const tokens = tokenize(queryOrScenarioId);
  const rag = retrieveSectionRagContext(queryOrScenarioId, activeTab, 4);

  let bestFaq: FaqItem | null = null;
  let bestFaqScore = 0;

  for (const faq of allFaqs) {
    const qHits = scoreTextOverlap(tokens, faq.question) * 3;
    const aHits = scoreTextOverlap(tokens, faq.answer) * 1.2;
    const score = qHits + aHits;
    if (score > bestFaqScore) {
      bestFaqScore = score;
      bestFaq = faq;
    }
  }

  if (bestFaq && bestFaqScore >= 2.4) {
    const scenarioObj = ALL_FAQ_SCENARIOS.find((s) => s.faqId === bestFaq!.id);
    const relatedScenarios = ALL_FAQ_SCENARIOS.filter(
      (s) => s.faqId !== bestFaq!.id && s.group === bestFaq!.category
    ).slice(0, 2);

    const extraRag = rag.chunks.find((c) => c.sourceType === 'methodology' || c.sourceType === 'section');

    const parts = [
      `По базе FAQ РЦА («${bestFaq.question}»):\n${bestFaq.answer}`,
      extraRag ? `Контекст раздела «${section.sectionName}»: ${extraRag.content}` : '',
      scenarioObj ? `Следующий шаг: ${scenarioObj.nextStepHint}` : '',
    ].filter(Boolean);

    return {
      answer: parts.join('\n\n'),
      matchedFaq: bestFaq,
      sectionHint: `${section.sectionName} — ${section.contextFocus}`,
      relatedScenarios,
      ragChunks: rag.chunks,
    };
  }

  // Fallback grounded in top RAG chunk + closest scenarios
  const topChunk = rag.chunks.find((c) => c.id !== `section-${activeTab}`) ?? rag.chunks[0];
  const fallbackRelated = ALL_FAQ_SCENARIOS.slice(0, 3);

  return {
    answer: [
      `По материалам раздела «${section.sectionName}» (${topChunk.sourceLabel}):\n${topChunk.content}`,
      `Если требуется индивидуальная проверка документов или нестандартный маршрут, обратитесь в приёмную комиссию РЦА: ${CONTACTS.phone}, ${CONTACTS.email} (${CONTACTS.address}).`,
    ].join('\n\n'),
    matchedFaq: null,
    sectionHint: `${section.sectionName} — ${section.contextFocus}`,
    relatedScenarios: fallbackRelated,
    ragChunks: rag.chunks,
  };
}
