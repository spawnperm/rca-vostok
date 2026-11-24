import {
  COMPLEXITY_RANK,
  type ExpeditionComplexity,
  type ExperienceLogEntry,
} from '../domain/experience/ExperienceEntry.ts';
import type { SessionUser } from './identityApi.ts';
import type { SelfCheckEvaluation } from './qualificationSelfCheck.ts';

export type UserQualificationLevelId = 'novice' | 'intermediate' | 'advanced';
export type UpdateFeedCategory = 'system' | 'event' | 'advice';
export type UpdateFeedActionTarget =
  | 'calendar'
  | 'self_check'
  | 'gear'
  | 'experience'
  | 'assistant'
  | 'inquiries';

export interface UserQualificationProfile {
  level: UserQualificationLevelId;
  label: string;
  shortLabel: string;
  complexityRange: string;
  description: string;
  reasons: string[];
}

export interface UpdateFeedInquiryInput {
  id: string;
  track: string;
  region: string;
  status: 'new' | 'in_review' | 'needs_documents' | 'approved' | 'rejected';
  statusComment?: string | null;
  createdAt: string;
}

export interface UpdateFeedRegionalEventInput {
  id: string;
  title: string;
  regionLabel: string;
  shortDate: string;
  isoTargetDate: string;
  venue: string;
  tracks: string;
  submissionDeadline: string;
  kindLabel: string;
}

export interface UpdateFeedItem {
  id: string;
  kind: UpdateFeedCategory;
  kindLabel: string;
  title: string;
  message: string;
  metaLine: string;
  dateLabel: string;
  priority: 'high' | 'normal';
  targetLevels: readonly UserQualificationLevelId[];
  actionTarget?: UpdateFeedActionTarget;
  actionLabel?: string;
  actionPrompt?: string;
}

export const QUALIFICATION_LEVEL_META: Record<
  UserQualificationLevelId,
  {
    label: string;
    shortLabel: string;
    complexityRange: string;
    description: string;
  }
> = {
  novice: {
    label: 'Начальный уровень (Соискатель · 0–1 КС)',
    shortLabel: 'Начальный · 0–1 КС',
    complexityRange: 'н/к – 1 КС',
    description:
      'Фокус на базовом пакете документов, программе ДПО ВВГУ (≈ 250 ч), первой помощи WFA и первых категорийных выходах.',
  },
  intermediate: {
    label: 'Базовый практик (1–2 КС · Подготовка к экзамену)',
    shortLabel: 'Базовый практик · 1–2 КС',
    complexityRange: '1–2 КС',
    description:
      'Фокус на паспортизации маршрутов (ПП № 760), зачёте походного стажа по Контуру А и полевом зачёте на полигоне.',
  },
  advanced: {
    label: 'Опытный / Аттестованный проводник (3–5 КС)',
    shortLabel: 'Опытный · 3–5 КС',
    complexityRange: '3–5 КС',
    description:
      'Фокус на сложных автономных маршрутах, контроле сроков переаттестации, руководстве стажировками и методической экспертизе.',
  },
};

export function resolveUserQualificationProfile(params: {
  user: Pick<SessionUser, 'role' | 'region' | 'attestationExpiresAt'>;
  attestationPercent?: number;
  selfCheck?: SelfCheckEvaluation | null;
  journalEntries?: readonly ExperienceLogEntry[];
}): UserQualificationProfile {
  const { user, attestationPercent = 0, selfCheck = null, journalEntries = [] } = params;

  let maxRank = 0;
  let maxComplexity: ExpeditionComplexity = 'н/к';
  for (const entry of journalEntries) {
    const rank = COMPLEXITY_RANK[entry.complexity] ?? 0;
    if (rank > maxRank) {
      maxRank = rank;
      maxComplexity = entry.complexity;
    }
  }

  const reasons: string[] = [];
  let level: UserQualificationLevelId = 'novice';

  const isPrivilegedOrCertified =
    user.role === 'instructor' || user.role === 'curator' || user.role === 'admin';

  if (isPrivilegedOrCertified) {
    level = 'advanced';
    reasons.push(
      user.role === 'instructor'
        ? 'Роль в системе: действующий инструктор-проводник'
        : 'Экспертная роль в контуре РЦА'
    );
  } else if (maxRank >= 3 && (attestationPercent >= 70 || (selfCheck?.readinessPercent ?? 0) >= 75)) {
    level = 'advanced';
    reasons.push(`Опыт в журнале до ${maxComplexity} и высокая готовность (${Math.max(attestationPercent, selfCheck?.readinessPercent ?? 0)}%)`);
  } else if (
    maxRank >= 2 ||
    attestationPercent >= 40 ||
    (selfCheck && selfCheck.answeredCount >= 4 && selfCheck.readinessPercent >= 50)
  ) {
    level = 'intermediate';
    if (maxRank >= 2) {
      reasons.push(`В журнале зафиксированы маршруты до ${maxComplexity}`);
    }
    if (attestationPercent >= 40) {
      reasons.push(`Прогресс аттестации: ${attestationPercent}%`);
    }
    if (selfCheck && selfCheck.readinessPercent >= 50) {
      reasons.push(`Самопроверка квалификации: ${selfCheck.readinessPercent}%`);
    }
  } else {
    level = 'novice';
    reasons.push('Стартовый контур соискателя (0–1 КС)');
    if (journalEntries.length > 0) {
      reasons.push(`Записей в журнале: ${journalEntries.length} (макс. ${maxComplexity})`);
    }
  }

  if (reasons.length === 0) {
    reasons.push('Профиль сформирован по данным личного кабинета');
  }

  const meta = QUALIFICATION_LEVEL_META[level];
  return {
    level,
    ...meta,
    reasons,
  };
}

interface CuratedRcaEventDef {
  id: string;
  title: string;
  message: string;
  metaLine: string;
  dateLabel: string;
  priority: 'high' | 'normal';
  targetLevels: readonly UserQualificationLevelId[];
  actionTarget: UpdateFeedActionTarget;
  actionLabel: string;
}

const CURATED_RCA_EVENTS: readonly CuratedRcaEventDef[] = [
  {
    id: 'rca-evt-dpo-orientation',
    title: 'Вводный вебинар ДПО ВВГУ: старт подготовки соискателей (250 ч и субсидии до 70%)',
    message:
      'Разбор перечня документов (паспорт, СНИЛС, меддопуск), графика дистанционной теории и условий субсидирования для туркомпаний ДФО.',
    metaLine: 'Онлайн ВВГУ · Для соискателей 0–1 КС',
    dateLabel: 'Ежемесячно · Ближайший поток',
    priority: 'high',
    targetLevels: ['novice'],
    actionTarget: 'assistant',
    actionLabel: 'Уточнить условия ДПО',
  },
  {
    id: 'rca-evt-wfa-novice',
    title: 'Открытый практикум по базовой аптечке и стандарту WFA (первая помощь в тайге)',
    message:
      'Отработка остановки кровотечений, иммобилизации, защиты от гипотермии и алгоритма извлечения клеща перед первым категорийным выходом.',
    metaLine: 'Владивосток, ул. Гоголя, 41 (ауд. РЦА)',
    dateLabel: 'Приглашение РЦА',
    priority: 'normal',
    targetLevels: ['novice', 'intermediate'],
    actionTarget: 'gear',
    actionLabel: 'Сверить аптечку в генераторе',
  },
  {
    id: 'rca-evt-shkotovo-polygon',
    title: 'Полевой учебно-экзаменационный сбор на полигоне в Шкотовском районе',
    message:
      'Отработка ориентирования по азимуту, навесных переправ и взаимодействия со спасательными службами перед очной аттестацией 1–2 КС.',
    metaLine: 'Шкотовский р-н, Приморский край · Полигон РЦА',
    dateLabel: 'Открыта запись на поток',
    priority: 'high',
    targetLevels: ['intermediate'],
    actionTarget: 'calendar',
    actionLabel: 'Выбрать дату в календаре',
  },
  {
    id: 'rca-evt-passport-760',
    title: 'Методический разбор: защита паспорта маршрута (ПП РФ № 760) без возврата на доработку',
    message:
      'Проверка типовых ошибок в расчёте контрольных сроков, точек экстренной связи (Garmin inReach) и согласовании нитки маршрута с ООПТ.',
    metaLine: 'Методический центр РЦА · ВВГУ',
    dateLabel: 'Приглашение на семинар',
    priority: 'normal',
    targetLevels: ['intermediate', 'advanced'],
    actionTarget: 'self_check',
    actionLabel: 'Проверить готовность',
  },
  {
    id: 'rca-evt-advanced-expedition',
    title: 'Экспертная комиссия и полевой практикум 3–5 КС: автономные спасработы ДФО',
    message:
      'Специализированная сессия для опытных проводников: сложные переправы, оценка лавинной и паводковой обстановки, ведение стажировок.',
    metaLine: 'РЦА «Русский Восток» · ФСТР и ВВГУ',
    dateLabel: 'Спецпоток 3–5 КС',
    priority: 'high',
    targetLevels: ['advanced'],
    actionTarget: 'calendar',
    actionLabel: 'Открыть расписание комиссий',
  },
  {
    id: 'rca-evt-oopt-council',
    title: 'Рабочая встреча гидов-экспертов с представителями ООПТ Приморья и Камчатки',
    message:
      'Актуализация протоколов безопасности при встрече с крупными хищниками и квот рекреационной нагрузки на сезон 2027.',
    metaLine: 'Межрегиональный контур ДФО',
    dateLabel: 'Приглашение для аттестованных',
    priority: 'normal',
    targetLevels: ['advanced'],
    actionTarget: 'experience',
    actionLabel: 'Открыть журнал и карту',
  },
];

interface CuratedSkillAdviceDef {
  id: string;
  title: string;
  message: string;
  metaLine: string;
  priority: 'high' | 'normal';
  targetLevels: readonly UserQualificationLevelId[];
  actionTarget: UpdateFeedActionTarget;
  actionLabel: string;
}

const CURATED_SKILL_ADVICE: readonly CuratedSkillAdviceDef[] = [
  {
    id: 'adv-novice-journal',
    title: 'Начните системно вести «Журнал профессионального опыта» и импортируйте GPX-треки',
    message:
      'Даже некатегорийные походы (н/к) и выходы 1 КС с треками формируют доказательную базу стажа для допуска к экзамену.',
    metaLine: 'Развитие навыков · Документирование стажа',
    priority: 'high',
    targetLevels: ['novice'],
    actionTarget: 'experience',
    actionLabel: 'Добавить поход в журнал',
  },
  {
    id: 'adv-novice-selfcheck',
    title: 'Пройдите самопроверку из 8 критериев квалификации',
    message:
      'Оценка выявит недостающие документы (медсправка, ДПО) и подскажет, подходит ли вам Контур А или полная программа ВВГУ.',
    metaLine: 'Развитие навыков · Диагностика соискателя',
    priority: 'normal',
    targetLevels: ['novice'],
    actionTarget: 'self_check',
    actionLabel: 'Пройти самопроверку',
  },
  {
    id: 'adv-intermediate-contour-a',
    title: 'Систематизируйте маршрутные книжки и договоры для зачёта по Контуру А',
    message:
      'На уровне 1–2 КС подтверждённый опыт коммерческого сопровождения позволяет сократить теоретическое обучение и быстрее выйти на полигон.',
    metaLine: 'Развитие навыков · Повышение категории',
    priority: 'high',
    targetLevels: ['intermediate'],
    actionTarget: 'assistant',
    actionLabel: 'Спросить ассистента о Контуре А',
  },
  {
    id: 'adv-intermediate-gear',
    title: 'Отработайте комплектацию технической и медицинской укладки для 2–3 КС',
    message:
      'Используйте генератор чек-листа снаряжения перед следующим выходом: особое внимание — верёвочной страховке, шинам SAM Splint и фальшфейерам.',
    metaLine: 'Развитие навыков · Полевая безопасность',
    priority: 'normal',
    targetLevels: ['intermediate'],
    actionTarget: 'gear',
    actionLabel: 'Открыть генератор чек-листа',
  },
  {
    id: 'adv-advanced-reattestation',
    title: 'Контролируйте срок действия удостоверения (5 лет) и обновляйте сложные маршруты',
    message:
      'Для подтверждения допуска 3–5 КС при плановой переаттестации важно иметь актуальные записи автономных экспедиций в журнале за последние 2 года.',
    metaLine: 'Развитие навыков · Продление допуска ЕФРТА',
    priority: 'high',
    targetLevels: ['advanced'],
    actionTarget: 'experience',
    actionLabel: 'Проверить журнал и карту',
  },
  {
    id: 'adv-advanced-mentoring',
    title: 'Стандартизируйте протоколы ЧС и аварийной эвакуации для сложных экспедиций ДФО',
    message:
      'Проверьте наличие резервных трекеров, расширенной укладки WFA и актуальных контактов ПСО МЧС в генераторе снаряжения.',
    metaLine: 'Развитие навыков · Лидерство и ПСР',
    priority: 'normal',
    targetLevels: ['advanced'],
    actionTarget: 'gear',
    actionLabel: 'Проверить экспедиционный чек-лист',
  },
];

export function buildQualificationUpdatesFeed(params: {
  user: Pick<SessionUser, 'id' | 'role' | 'region' | 'attestationExpiresAt'>;
  qualification: UserQualificationProfile;
  inquiries?: readonly UpdateFeedInquiryInput[];
  attestationPercent?: number;
  selfCheck?: SelfCheckEvaluation | null;
  journalEntries?: readonly ExperienceLogEntry[];
  regionalEvents?: readonly UpdateFeedRegionalEventInput[];
  includeOtherLevels?: boolean;
  todayIso?: string;
}): UpdateFeedItem[] {
  const {
    user,
    qualification,
    inquiries = [],
    attestationPercent = 0,
    selfCheck = null,
    journalEntries = [],
    regionalEvents = [],
    includeOtherLevels = false,
    todayIso = new Date().toISOString().slice(0, 10),
  } = params;

  const items: UpdateFeedItem[] = [];

  // 1. System notifications (strictly tied to user state & qualification level)
  if (inquiries.length > 0) {
    const latest = inquiries[0];
    const statusMap: Record<UpdateFeedInquiryInput['status'], string> = {
      new: 'Заявка зарегистрирована и ожидает первичной проверки куратором РЦА.',
      in_review: 'Заявка находится на рассмотрении аттестационной комиссии.',
      needs_documents:
        latest.statusComment?.trim() ||
        'Комиссия запросила уточнение документов (медсправка, стаж или паспорт маршрута № 760).',
      approved: 'Пакет документов одобрен. Доступна запись на ближайшую экзаменационную сессию.',
      rejected: 'Заявка требует доработки данных перед повторной подачей.',
    };

    items.push({
      id: `sys-inq-${latest.id}-${latest.status}`,
      kind: 'system',
      kindLabel: 'Системное уведомление',
      title: `Статус заявки «${latest.track}»`,
      message: statusMap[latest.status],
      metaLine: `${latest.region} · Профиль: ${qualification.shortLabel}`,
      dateLabel: new Date(latest.createdAt).toLocaleDateString('ru-RU'),
      priority:
        latest.status === 'needs_documents' || latest.status === 'rejected'
          ? 'high'
          : 'normal',
      targetLevels: [qualification.level],
      actionTarget: 'inquiries',
      actionLabel: 'Открыть мои заявки',
    });
  } else {
    items.push({
      id: `sys-no-inquiry-${qualification.level}`,
      kind: 'system',
      kindLabel: 'Системное уведомление',
      title:
        qualification.level === 'advanced'
          ? 'Реестровый контур: проверьте график плановых сессий и переаттестации'
          : 'Системный статус: заявка на ближайшую сессию ещё не оформлена',
      message:
        qualification.level === 'advanced'
          ? 'Вы можете заранее забронировать дату подтверждения квалификации или подать заявку на расширение категории сложности.'
          : 'После выбора даты в календаре комиссий заявка автоматически появится в вашем личном кабинете.',
      metaLine: `${user.region} · Уровень: ${qualification.shortLabel}`,
      dateLabel: 'Актуально сейчас',
      priority: qualification.level === 'novice' ? 'high' : 'normal',
      targetLevels: [qualification.level],
      actionTarget: 'calendar',
      actionLabel: 'Открыть календарь сессий',
    });
  }

  if (user.attestationExpiresAt) {
    const daysLeft = Math.round(
      (Date.parse(`${user.attestationExpiresAt}T00:00:00Z`) -
        Date.parse(`${todayIso}T00:00:00Z`)) /
        (1000 * 60 * 60 * 24)
    );
    if (Number.isFinite(daysLeft) && daysLeft <= 180) {
      items.push({
        id: `sys-expiry-${user.attestationExpiresAt}`,
        kind: 'system',
        kindLabel: 'Системное уведомление',
        title:
          daysLeft < 0
            ? 'Срок действия аттестации истёк — требуется переаттестация'
            : `Приближается срок плановой переаттестации (осталось ${daysLeft} дн.)`,
        message:
          'Зафиксируйте актуальные маршруты в журнале опыта и подайте заявку на подтверждение статуса в РЦА «Русский Восток».',
        metaLine: `Срок до ${user.attestationExpiresAt} · ЕФРТА`,
        dateLabel: 'Контроль срока',
        priority: 'high',
        targetLevels: ['intermediate', 'advanced'],
        actionTarget: 'calendar',
        actionLabel: 'Записаться на переаттестацию',
      });
    }
  }

  if (attestationPercent > 0 && attestationPercent < 100) {
    items.push({
      id: `sys-progress-${qualification.level}`,
      kind: 'system',
      kindLabel: 'Системное уведомление',
      title: `Прогресс аттестационного маршрута: ${attestationPercent}%`,
      message:
        attestationPercent >= 65
          ? 'Основная часть этапов выполнена — проверьте готовность паспорта маршрута № 760 и запись на полевой экзамен.'
          : 'Закройте оставшиеся пункты чек-листа подготовки в разделе «Подготовка и путь».',
      metaLine: `Аттестация РЦА · ${qualification.complexityRange}`,
      dateLabel: 'Монитор прогресса',
      priority: 'normal',
      targetLevels: ['novice', 'intermediate'],
      actionTarget: 'self_check',
      actionLabel: 'Перейти к подготовке',
    });
  }

  // 2. RЦА Event Invitations (curated + dynamic upcoming sessions matching user level & region)
  for (const evt of CURATED_RCA_EVENTS) {
    items.push({
      id: evt.id,
      kind: 'event',
      kindLabel: 'Приглашение на мероприятие РЦА',
      title: evt.title,
      message: evt.message,
      metaLine: evt.metaLine,
      dateLabel: evt.dateLabel,
      priority: evt.priority,
      targetLevels: evt.targetLevels,
      actionTarget: evt.actionTarget,
      actionLabel: evt.actionLabel,
    });
  }

  for (const regEv of regionalEvents) {
    if (regEv.isoTargetDate < todayIso) continue;
    const isAdvancedSession = /переаттестац|3–4|4 кс/i.test(
      `${regEv.title} ${regEv.tracks}`
    );
    const targetLevels: UserQualificationLevelId[] = isAdvancedSession
      ? ['intermediate', 'advanced']
      : ['novice', 'intermediate'];
    const regionMatch = regEv.regionLabel
      .toLowerCase()
      .includes(user.region.slice(0, 5).toLowerCase());

    items.push({
      id: `reg-evt-${regEv.id}`,
      kind: 'event',
      kindLabel: regionMatch
        ? `Мероприятие РЦА · Ваш регион`
        : 'Приглашение на мероприятие РЦА',
      title: regEv.title,
      message: `${regEv.submissionDeadline}. Площадка: ${regEv.venue}. Треки: ${regEv.tracks}.`,
      metaLine: `${regEv.shortDate} · ${regEv.regionLabel}`,
      dateLabel: regEv.shortDate,
      priority: regionMatch ? 'high' : 'normal',
      targetLevels,
      actionTarget: 'calendar',
      actionLabel: 'Забронировать место',
    });
  }

  // 3. Personal Skill-Development Advice (dynamic gaps from self-check + curated advice)
  if (selfCheck && selfCheck.recommendations.length > 0) {
    for (const rec of selfCheck.recommendations.slice(0, 2)) {
      items.push({
        id: `adv-gap-${rec.questionId}`,
        kind: 'advice',
        kindLabel: 'Персональный совет · Зона роста',
        title: `Усилить навык: ${rec.title}`,
        message: rec.actionHint,
        metaLine: `${rec.domainLabel} · По вашей самопроверке`,
        dateLabel: rec.severity === 'critical' ? 'Приоритет' : 'Рекомендация',
        priority: rec.severity === 'critical' ? 'high' : 'normal',
        targetLevels: [qualification.level],
        actionTarget: 'self_check',
        actionLabel: 'Открыть самопроверку',
      });
    }
  }

  if (journalEntries.length > 0) {
    const hasWater = journalEntries.some((e) =>
      /(сплав|рафт|каяк|река)/i.test(e.routeTitle)
    );
    if (!hasWater && qualification.level !== 'novice') {
      items.push({
        id: `adv-cross-track-${qualification.level}`,
        kind: 'advice',
        kindLabel: 'Персональный совет · Расширение профиля',
        title: 'Расширьте квалификацию модулем безопасности на водных переправах',
        message:
          'В вашем журнале преобладают наземные маршруты — добавление водной практики повышает универсальность гида на реках ДФО.',
        metaLine: 'Аналитика журнала опыта · Кросс-навык',
        dateLabel: 'Персонально',
        priority: 'normal',
        targetLevels: ['intermediate', 'advanced'],
        actionTarget: 'assistant',
        actionLabel: 'Уточнить программу у ассистента',
        actionPrompt:
          'Какие требования предъявляются для расширения квалификации на водный туризм и переправы в РЦА «Русский Восток»?',
      });
    }
  }

  for (const adv of CURATED_SKILL_ADVICE) {
    items.push({
      id: adv.id,
      kind: 'advice',
      kindLabel: 'Совет по развитию навыков',
      title: adv.title,
      message: adv.message,
      metaLine: adv.metaLine,
      dateLabel: `Уровень: ${QUALIFICATION_LEVEL_META[qualification.level].complexityRange}`,
      priority: adv.priority,
      targetLevels: adv.targetLevels,
      actionTarget: adv.actionTarget,
      actionLabel: adv.actionLabel,
    });
  }

  const filtered = includeOtherLevels
    ? items
    : items.filter((item) => item.targetLevels.includes(qualification.level));

  const kindOrder: Record<UpdateFeedCategory, number> = {
    system: 0,
    advice: 1,
    event: 2,
  };

  return filtered.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
    return kindOrder[a.kind] - kindOrder[b.kind];
  });
}
