import { formatSessionRange, CERTIFICATION_SCHEDULE } from '../data/landingContent.ts';
import type { SessionUser } from './identityApi.ts';
import type { InquiryRecord } from '../components/social/MyInquiriesSection.tsx';
import { formatRussianDate } from './personalRoadmap.ts';

export type DocumentStatusTone = 'success' | 'info' | 'warning' | 'danger';

export interface DocumentStatusNotification {
  id: string;
  statusLabel: string;
  title: string;
  description: string;
  dateLabel: string;
  tone: DocumentStatusTone;
  isPersonal: boolean;
}

const INQUIRY_TITLE_BY_STATUS: Record<InquiryRecord['status'], string> = {
  new: 'Заявка принята',
  in_review: 'Документы на проверке комиссии',
  needs_documents: 'Требуются дополнительные документы',
  approved: 'Комплект документов одобрен',
  rejected: 'Требуется доработка документов',
};

const INQUIRY_DESC_BY_STATUS: Record<InquiryRecord['status'], string> = {
  new: 'Анкета и заявка зарегистрированы в очереди РЦА «Русский Восток». Ожидается первичная сверка стажа.',
  in_review:
    'Секретарь комиссии проверяет медицинский допуск и подтверждение опыта прохождения маршрутов.',
  needs_documents:
    'Комиссия запросила недостающие документы (медсправка, подтверждение стажа или паспорт маршрута ПП № 760).',
  approved:
    'Допуск к аттестационной сессии подтверждён. Можно выбирать дату экзамена в личном кабинете.',
  rejected:
    'Выявлены неточности в сведениях о маршрутном опыте или документах. Уточните данные и подайте заявку повторно.',
};

const INQUIRY_TONE_BY_STATUS: Record<InquiryRecord['status'], DocumentStatusTone> = {
  new: 'info',
  in_review: 'warning',
  needs_documents: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export function buildDocumentStatusNotifications(params: {
  user: SessionUser | null;
  inquiries: InquiryRecord[];
  examDateIso?: string;
}): DocumentStatusNotification[] {
  const { user, inquiries, examDateIso } = params;
  const nearestSession = CERTIFICATION_SCHEDULE[0];
  const nearestSessionLabel = nearestSession
    ? formatSessionRange(nearestSession.start, nearestSession.end)
    : 'Весна 2027';

  if (!user) {
    return [
      {
        id: 'guest-intake',
        statusLabel: 'Приём заявок открыт',
        title: 'Заявка принята к первичной обработке',
        description:
          'После входа в личный кабинет и отправки анкеты здесь отображается статус проверки вашего комплекта документов.',
        dateLabel: 'Текущий набор 2026–2027',
        tone: 'info',
        isPersonal: false,
      },
      {
        id: 'guest-exam',
        statusLabel: 'График сессий 2027',
        title: `Назначена дата экзамена: ${nearestSessionLabel}`,
        description:
          'Ближайшая очная аттестационная сессия категорий 1–4 КС в РЦА «Русский Восток» (г. Владивосток и полигон Шкотовского района).',
        dateLabel: nearestSessionLabel,
        tone: 'success',
        isPersonal: false,
      },
      {
        id: 'guest-registry',
        statusLabel: 'Регламент ПП № 1893',
        title: 'Срок внесения в Единый федеральный реестр — до 5 рабочих дней',
        description:
          'По итогам успешного прохождения теоретического и полевого этапов оформляется протокол и нагрудный бейдж инструктора-проводника.',
        dateLabel: 'Действие 5 лет',
        tone: 'info',
        isPersonal: false,
      },
    ];
  }

  const items: DocumentStatusNotification[] = [];

  if (inquiries.length > 0) {
    inquiries.forEach((inq) => {
      const dateLabel = new Date(inq.createdAt).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      items.push({
        id: `doc-inq-${inq.id}-${inq.status}`,
        statusLabel: inq.track,
        title: INQUIRY_TITLE_BY_STATUS[inq.status],
        description: INQUIRY_DESC_BY_STATUS[inq.status],
        dateLabel,
        tone: INQUIRY_TONE_BY_STATUS[inq.status],
        isPersonal: true,
      });
    });
  } else {
    items.push({
      id: `doc-no-inq-${user.id}`,
      statusLabel: user.region,
      title: 'Ожидается подача комплекта документов',
      description:
        'Для запуска проверки в приёмной комиссии заполните заявку на аттестацию и приложите сведения о стаже.',
      dateLabel: 'Шаг 01',
      tone: 'warning',
      isPersonal: true,
    });
  }

  if (examDateIso) {
    items.push({
      id: `doc-exam-${user.id}-${examDateIso}`,
      statusLabel: 'Экзаменационная сессия',
      title: `Назначена дата экзамена: ${formatRussianDate(examDateIso)}`,
      description:
        'Дата зафиксирована в вашей индивидуальной дорожной карте. Подготовьте паспорт маршрута (форма ПП № 760) к защите.',
      dateLabel: formatRussianDate(examDateIso),
      tone: 'success',
      isPersonal: true,
    });
  } else {
    items.push({
      id: `doc-exam-default-${user.id}`,
      statusLabel: 'Расписание 2027',
      title: `Ближайшая сессия комиссии: ${nearestSessionLabel}`,
      description:
        'Вы можете зафиксировать удобную дату экзамена в «Индивидуальной дорожной карте» личного кабинета.',
      dateLabel: nearestSessionLabel,
      tone: 'info',
      isPersonal: true,
    });
  }

  if (user.role === 'instructor') {
    items.push({
      id: `doc-registry-active-${user.id}`,
      statusLabel: 'Единый федеральный реестр',
      title: 'Статус инструктора-проводника подтверждён',
      description:
        'Документы об аттестации заверены комиссией РЦА и ВВГУ. Свидетельство действует 5 лет.',
      dateLabel: 'В реестре',
      tone: 'success',
      isPersonal: true,
    });
  }

  return items;
}
