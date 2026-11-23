import type { InstructorReviewListItem } from '../components/InstructorReviewsSection.tsx';

export type CertifiedReviewTrack = 'hiking' | 'water' | 'expedition' | 'auto';
export type CertifiedReviewTrackFilter = 'all' | CertifiedReviewTrack;

export interface CertifiedInstructorReviewSlide {
  id: string;
  authorName: string;
  role: string;
  organization: string;
  region: string;
  track: CertifiedReviewTrack;
  trackLabel: string;
  contourLabel: string;
  certificateCode: string;
  batchLabel: string;
  overallRating: number;
  prepRating: number;
  examRating: number;
  quote: string;
  practicalOutcome: string;
  advice: string;
  source: 'community' | 'curated';
  verifiedInstructor: boolean;
  createdAt: string;
}

export const CERTIFIED_TRACK_FILTER_OPTIONS: {
  id: CertifiedReviewTrackFilter;
  label: string;
}[] = [
  { id: 'all', label: 'Все направления' },
  { id: 'hiking', label: 'Пешеходный и горный' },
  { id: 'water', label: 'Водный и морской' },
  { id: 'expedition', label: 'ООПТ и экспедиции' },
  { id: 'auto', label: 'Автотуры ДФО' },
];

export const CURATED_CERTIFIED_INSTRUCTOR_REVIEWS: CertifiedInstructorReviewSlide[] =
  [
    {
      id: 'cert-review-kovalev',
      authorName: 'Дмитрий Ковалёв',
      role: 'Инструктор-проводник 2 КС · Пешеходный и горный туризм',
      organization: 'Турклуб «Хребты Приморья»',
      region: 'Приморский край',
      track: 'hiking',
      trackLabel: 'Пешеходный и горный туризм',
      contourLabel: 'Контур А · зачёт стажа',
      certificateCode: 'РЦА-26-0418 · Реестр ФСТР',
      batchLabel: 'Октябрь 2026',
      overallRating: 5,
      prepRating: 5,
      examRating: 5,
      quote:
        'Восемь лет водил группы на Фалазу и Пидан по договорам с операторами, но без корочек МКК. В РЦА «Русский Восток» стаж зачли по Контуру А: сдал теорию в ВВГУ, защитил паспорт маршрута по ПП РФ № 760 и прошёл полевые испытания на полигоне в Шкотово за одну сессию.',
      practicalOutcome:
        'Аттестован с первой попытки на 5 лет · Допуск к коммерческому сопровождению групп до 2 КС.',
      advice:
        'До подачи заявки сведите GPS-треки и договоры с туроператором в единый реестр — это экономит около двух недель.',
      source: 'curated',
      verifiedInstructor: true,
      createdAt: '2026-10-19T09:30:00Z',
    },
    {
      id: 'cert-review-martynova',
      authorName: 'Елена Мартынова',
      role: 'Аттестованный инструктор-проводник · Экотропы ООПТ',
      organization: 'Агентство «Амурский маршрут»',
      region: 'Хабаровский край',
      track: 'expedition',
      trackLabel: 'Экспедиционный / ООПТ',
      contourLabel: 'Контур Б · ДПО ВВГУ 250 ч',
      certificateCode: 'РЦА-26-0372 · Реестр ДФО',
      batchLabel: 'Сентябрь 2026',
      overallRating: 5,
      prepRating: 5,
      examRating: 5,
      quote:
        'Переходила из городской экскурсионной практики на маршруты национального парка «Анюйский». Программа ДПО ВВГУ дала системную базу по автономной первой помощи и расчёту рекреационной нагрузки, а комиссия детально и доброжелательно разобрала паспорт маршрута.',
      practicalOutcome:
        'Получила нагрудную карточку и официальный допуск к ведению групп на особо охраняемых территориях ДФО.',
      advice:
        'Отработайте блок Wilderness First Aid и заранее проверьте точки эвакуации по требованиям ПП РФ № 760.',
      source: 'curated',
      verifiedInstructor: true,
      createdAt: '2026-09-28T11:15:00Z',
    },
    {
      id: 'cert-review-samoilov',
      authorName: 'Андрей Самойлов',
      role: 'Инструктор-проводник 3 КС · Водный и комбинированный туризм',
      organization: 'Экспедиционный центр «Камчатка-Трек»',
      region: 'Камчатский край',
      track: 'water',
      trackLabel: 'Водный туризм и сплавы',
      contourLabel: 'Контур А · переаттестация',
      certificateCode: 'РЦА-26-0409 · Реестр ФСТР',
      batchLabel: 'Октябрь 2026',
      overallRating: 4.7,
      prepRating: 5,
      examRating: 4,
      quote:
        'Готовился с Камчатки дистанционно: прошёл правовой модуль по ПП № 1893 и обновил протоколы спутниковой связи, а в Приморье прилетел на сдвоенную сессию. За три дня закрыли тестирование в университете и практику спасработ на речном полигоне.',
      practicalOutcome:
        'Сведения внесены в Единый федеральный реестр инструкторов-проводников за 9 рабочих дней.',
      advice:
        'Соискателям из отдалённых краёв ДФО удобно выбирать сдвоенный график «теория + полигон» в одну командировку.',
      source: 'curated',
      verifiedInstructor: true,
      createdAt: '2026-10-16T07:45:00Z',
    },
    {
      id: 'cert-review-tereshchenko',
      authorName: 'Ольга Терещенко',
      role: 'Инструктор-проводник · Прибрежный морской каякинг и SUP',
      organization: 'Морской клуб «Бухта Новик»',
      region: 'Приморский край',
      track: 'water',
      trackLabel: 'Водный и морской туризм',
      contourLabel: 'Контур Б · целевое обучение',
      certificateCode: 'РЦА-26-0315 · Реестр ФСТР',
      batchLabel: 'Август 2026',
      overallRating: 5,
      prepRating: 5,
      examRating: 5,
      quote:
        'Туроператор направил нашу команду на обучение в ВВГУ по целевому договору с региональной субсидией. На разборе нештатных ситуаций уделили максимум внимания отжимному ветру, связи на УКВ и действиям при потере видимости в морском тумане.',
      practicalOutcome:
        '70% стоимости обучения компенсировано работодателю по субсидии · Вся команда в реестре.',
      advice:
        'Если работаете в штате туркомпании или глэмпинга, уточните оформление целевого договора с ВВГУ.',
      source: 'curated',
      verifiedInstructor: true,
      createdAt: '2026-08-22T14:20:00Z',
    },
    {
      id: 'cert-review-belozerov',
      authorName: 'Сергей Белозёров',
      role: 'Инструктор-проводник 2 КС · Горный и береговой треккинг',
      organization: 'Сообщество гидов Сахалина и Курил',
      region: 'Сахалинская область',
      track: 'hiking',
      trackLabel: 'Горный и прибрежный треккинг',
      contourLabel: 'Контур А · зачёт стажа',
      certificateCode: 'РЦА-26-0288 · Реестр ФСТР',
      batchLabel: 'Август 2026',
      overallRating: 4.8,
      prepRating: 4,
      examRating: 5,
      quote:
        'Подтвердил походный опыт маршрутными книжками МКК и подтянул формулировки ФЗ № 132-ФЗ через глоссарий и тренировочный тест. Комиссия ценит реальный опыт в поле, но требования по страховке группы и оказанию первой помощи проверяет строго.',
      practicalOutcome:
        'Успешная аттестация за 1 очную сессию · Продление легального статуса работы на Курилах и Сахалине.',
      advice:
        'Потренируйтесь в мини-тесте самопроверки перед экзаменом — это снимает волнение на правовых вопросах.',
      source: 'curated',
      verifiedInstructor: true,
      createdAt: '2026-08-11T10:05:00Z',
    },
    {
      id: 'cert-review-gromov',
      authorName: 'Роман Громов',
      role: 'Инструктор-проводник · Автомобильные и экспедиционные маршруты',
      organization: 'Экспедиции «Амурский берег»',
      region: 'Амурская область',
      track: 'auto',
      trackLabel: 'Автомобильный туризм ДФО',
      contourLabel: 'Контур Б · программа ВВГУ',
      certificateCode: 'РЦА-26-0341 · Реестр ДФО',
      batchLabel: 'Сентябрь 2026',
      overallRating: 4.9,
      prepRating: 5,
      examRating: 5,
      quote:
        'Для автотуров высокой проходимости важно грамотно описать схему связи вне покрытия GSM и порядок эвакуации техники и людей. Методисты РЦА помогли выстроить паспорт маршрута к Зейскому водохранилищу по актуальному стандарту ФСТР.',
      practicalOutcome:
        'Паспорт автоэкспедиции защищён без замечаний · Аттестация пройдена на 5 лет.',
      advice:
        'Проверьте комплектность аптечки колонны и регламент связи в паспорте маршрута ещё на этапе вебинара.',
      source: 'curated',
      verifiedInstructor: true,
      createdAt: '2026-09-14T08:40:00Z',
    },
  ];

function detectTrack(trackText: string): CertifiedReviewTrack {
  const lower = trackText.toLowerCase();
  if (/вод|сплав|каяк|sup|морск/.test(lower)) return 'water';
  if (/экспед|оопт|заповед|нацпарк|экотроп/.test(lower)) return 'expedition';
  if (/авто|джип|колонн/.test(lower)) return 'auto';
  return 'hiking';
}

function detectContourLabel(noteText: string): string {
  if (/контур\s*б|дпо|250/i.test(noteText)) return 'Контур Б · ДПО ВВГУ';
  if (/переаттестац/i.test(noteText)) return 'Контур А · переаттестация';
  return 'Контур А · зачёт стажа';
}

function extractCommentSection(comment: string, prefix: string): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = comment.match(
    new RegExp(
      `${escaped}\\s*([\\s\\S]*?)(?=(?:\\n\\s*(?:Подготовка:|Экзамен:|Совет:)|$))`,
      'i'
    )
  );
  return match?.[1]?.trim() ?? '';
}

function sanitizeAdviceText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function parseCertifiedReviewsFromApi(
  apiReviews: readonly InstructorReviewListItem[]
): CertifiedInstructorReviewSlide[] {
  const slides: CertifiedInstructorReviewSlide[] = [];

  for (const item of apiReviews) {
    // Include verified certified instructors (or explicitly verified reviews)
    if (!item.verifiedInstructor) {
      continue;
    }

    const prepText = extractCommentSection(item.comment, 'Подготовка:');
    const examText = extractCommentSection(item.comment, 'Экзамен:');
    const adviceText = extractCommentSection(item.comment, 'Совет:');

    const combinedQuote = [prepText, examText]
      .filter(Boolean)
      .join(' ')
      .trim();
    const quote = combinedQuote || sanitizeAdviceText(item.comment);

    if (!quote) {
      continue;
    }

    const batchCandidate = item.sessionNote
      .split('·')
      .map((s) => s.trim())
      .find(
        (s) =>
          s.length > 0 &&
          !/история успеха/i.test(s) &&
          !/контур/i.test(s) &&
          !/^\d+\s*ч$/i.test(s)
      );

    slides.push({
      id: item.id,
      authorName: item.authorName,
      role: 'Аттестованный инструктор-проводник',
      organization: `Выпускник РЦА «Русский Восток»`,
      region: item.region || 'Приморский край',
      track: detectTrack(item.sessionTrack),
      trackLabel: item.sessionTrack || 'Активный туризм ДФО',
      contourLabel: detectContourLabel(`${item.sessionNote} ${item.sessionTrack}`),
      certificateCode: 'Подтверждён в реестре РЦА',
      batchLabel: batchCandidate || 'Сессия РЦА 2026',
      overallRating: Number(item.overallRating.toFixed(1)),
      prepRating: item.trainingRating,
      examRating: item.sessionRating,
      quote,
      practicalOutcome: item.recommendLabel
        ? `${item.recommendLabel} · Опыт аттестации подтверждён`
        : 'Аттестация пройдена · Отзыв проверен',
      advice:
        adviceText ||
        'Рекомендуем заранее сверить документы по паспорту маршрута и пройти тренировочный тест.',
      source: 'community',
      verifiedInstructor: true,
      createdAt: item.createdAt,
    });
  }

  return slides;
}

export function mergeCertifiedInstructorReviews(
  communitySlides: readonly CertifiedInstructorReviewSlide[],
  curatedSlides: readonly CertifiedInstructorReviewSlide[] = CURATED_CERTIFIED_INSTRUCTOR_REVIEWS
): CertifiedInstructorReviewSlide[] {
  const merged: CertifiedInstructorReviewSlide[] = [];
  const seenIds = new Set<string>();
  const seenAuthorRegion = new Set<string>();

  for (const slide of [...communitySlides, ...curatedSlides]) {
    const idKey = slide.id.trim().toLowerCase();
    const authorKey = `${slide.authorName.trim().toLowerCase()}::${slide.region.trim().toLowerCase()}`;
    if (seenIds.has(idKey) || seenAuthorRegion.has(authorKey)) {
      continue;
    }
    seenIds.add(idKey);
    seenAuthorRegion.add(authorKey);
    merged.push(slide);
  }

  return merged;
}

export function filterCertifiedInstructorReviews(
  slides: readonly CertifiedInstructorReviewSlide[],
  trackFilter: CertifiedReviewTrackFilter
): CertifiedInstructorReviewSlide[] {
  if (trackFilter === 'all') {
    return [...slides];
  }
  return slides.filter((slide) => slide.track === trackFilter);
}

export function wrapCarouselIndex(nextIndex: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return ((nextIndex % total) + total) % total;
}

export function computeReviewsAverageRating(
  slides: readonly CertifiedInstructorReviewSlide[]
): number | null {
  if (slides.length === 0) {
    return null;
  }
  const sum = slides.reduce((acc, item) => acc + item.overallRating, 0);
  return Math.round((sum / slides.length) * 10) / 10;
}
