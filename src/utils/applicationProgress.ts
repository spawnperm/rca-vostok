import type { InquiryRecord } from '../components/social/MyInquiriesSection.tsx';
import type { Role } from './identityApi.ts';

export type ApplicationProgressMilestoneId =
  | 'submitted'
  | 'verification'
  | 'commission'
  | 'attestation';

export type ApplicationStepVisualState =
  | 'completed'
  | 'current'
  | 'attention'
  | 'rejected'
  | 'pending';

export type ApplicationStatusKey =
  | 'no_inquiry'
  | 'new'
  | 'in_review'
  | 'needs_documents'
  | 'approved'
  | 'rejected'
  | 'certified';

export interface ApplicationProgressStep {
  id: ApplicationProgressMilestoneId;
  stepNumber: string;
  title: string;
  subtitle: string;
  state: ApplicationStepVisualState;
  stateLabel: string;
}

export interface ApplicationProgressModel {
  statusKey: ApplicationStatusKey;
  statusLabel: string;
  statusSummary: string;
  nextStepHint: string;
  progressPercent: number;
  completedStepsCount: number;
  totalStepsCount: number;
  activeStepNumber: number;
  tone: 'neutral' | 'teal' | 'amber' | 'emerald' | 'rose';
  activeInquiry: InquiryRecord | null;
  steps: ApplicationProgressStep[];
}

export interface ApplicationProgressInput {
  userRole?: Role | null;
  activeInquiry: InquiryRecord | null;
  overallChecklistPercent?: number;
}

/**
 * Computes the linear application-to-attestation progress model reflecting the
 * user's current certification inquiry status inside the Personal Cabinet.
 */
export function buildApplicationProgressModel({
  userRole = null,
  activeInquiry,
  overallChecklistPercent = 0,
}: ApplicationProgressInput): ApplicationProgressModel {
  const isCertifiedUser = userRole === 'instructor' || overallChecklistPercent >= 100;

  if (!activeInquiry) {
    if (isCertifiedUser) {
      return {
        statusKey: 'certified',
        statusLabel: 'Аттестация пройдена · Действующий проводник',
        statusSummary:
          'Профиль подтверждён в реестре РЦА «Русский Восток». Все этапы аттестации завершены.',
        nextStepHint:
          'Сведения об аттестации доступны в вашем цифровом паспорте и Едином реестре.',
        progressPercent: 100,
        completedStepsCount: 4,
        totalStepsCount: 4,
        activeStepNumber: 4,
        tone: 'emerald',
        activeInquiry: null,
        steps: [
          {
            id: 'submitted',
            stepNumber: '01',
            title: 'Заявка подана',
            subtitle: 'Анкета и трек подтверждены',
            state: 'completed',
            stateLabel: 'Выполнено',
          },
          {
            id: 'verification',
            stepNumber: '02',
            title: 'Документы проверены',
            subtitle: 'Стаж и меддопуск сверены',
            state: 'completed',
            stateLabel: 'Выполнено',
          },
          {
            id: 'commission',
            stepNumber: '03',
            title: 'К тестированию готов',
            subtitle: 'Допуск комиссии получен',
            state: 'completed',
            stateLabel: 'Выполнено',
          },
          {
            id: 'attestation',
            stepNumber: '04',
            title: 'Аттестован',
            subtitle: 'Свидетельство активно (5 лет)',
            state: 'completed',
            stateLabel: 'Выполнено',
          },
        ],
      };
    }

    return {
      statusKey: 'no_inquiry',
      statusLabel: 'Заявка на аттестацию не подана',
      statusSummary:
        'Для запуска аттестационного маршрута выберите ближайшую сессию в календаре и отправьте заявку.',
      nextStepHint:
        'После отправки анкеты секретарь РЦА проверит комплект документов в течение 1 рабочего дня.',
      progressPercent: 0,
      completedStepsCount: 0,
      totalStepsCount: 4,
      activeStepNumber: 1,
      tone: 'neutral',
      activeInquiry: null,
      steps: [
        {
          id: 'submitted',
          stepNumber: '01',
          title: 'Заявка подана',
          subtitle: 'Выбор сессии и трека',
          state: 'current',
          stateLabel: 'Ожидает подачи',
        },
        {
          id: 'verification',
          stepNumber: '02',
          title: 'Документы проверены',
          subtitle: 'Медсправка, стаж, паспорт',
          state: 'pending',
          stateLabel: 'Далее',
        },
        {
          id: 'commission',
          stepNumber: '03',
          title: 'К тестированию готов',
          subtitle: 'Согласование экзамена',
          state: 'pending',
          stateLabel: 'Далее',
        },
        {
          id: 'attestation',
          stepNumber: '04',
          title: 'Аттестован',
          subtitle: 'Сессия РЦА и реестр',
          state: 'pending',
          stateLabel: 'Далее',
        },
      ],
    };
  }

  const customComment = activeInquiry.statusComment?.trim();

  switch (activeInquiry.status) {
    case 'new':
      return {
        statusKey: 'new',
        statusLabel: 'Новая заявка · Принята в обработку',
        statusSummary:
          customComment ||
          'Заявка зарегистрирована в системе РЦА «Русский Восток» и ожидает первичной проверки секретарём.',
        nextStepHint:
          'Первичная сверка данных и назначение трека занимают до 1 рабочего дня.',
        progressPercent: 25,
        completedStepsCount: 1,
        totalStepsCount: 4,
        activeStepNumber: 2,
        tone: 'teal',
        activeInquiry,
        steps: [
          {
            id: 'submitted',
            stepNumber: '01',
            title: 'Заявка подана',
            subtitle: 'Зарегистрирована в РЦА',
            state: 'completed',
            stateLabel: 'Выполнено',
          },
          {
            id: 'verification',
            stepNumber: '02',
            title: 'Документы проверены',
            subtitle: 'Первичная сверка пакета',
            state: 'current',
            stateLabel: 'Текущий этап',
          },
          {
            id: 'commission',
            stepNumber: '03',
            title: 'К тестированию готов',
            subtitle: 'Рассмотрение стажа',
            state: 'pending',
            stateLabel: 'Ожидает',
          },
          {
            id: 'attestation',
            stepNumber: '04',
            title: 'Аттестован',
            subtitle: 'Сессия РЦА и реестр',
            state: 'pending',
            stateLabel: 'Ожидает',
          },
        ],
      };

    case 'needs_documents':
      return {
        statusKey: 'needs_documents',
        statusLabel: 'Требуются документы · Ожидание соискателя',
        statusSummary:
          customComment ||
          'Для продолжения рассмотрения необходимо дополнить пакет: справку о стаже/маршрутную книжку, меддопуск и паспорт маршрута.',
        nextStepHint:
          'Проверьте чек-лист подготовки и уточните недостающие документы у куратора или в таблице заявок.',
        progressPercent: 40,
        completedStepsCount: 1,
        totalStepsCount: 4,
        activeStepNumber: 2,
        tone: 'amber',
        activeInquiry,
        steps: [
          {
            id: 'submitted',
            stepNumber: '01',
            title: 'Заявка подана',
            subtitle: 'Заявка зарегистрирована',
            state: 'completed',
            stateLabel: 'Выполнено',
          },
          {
            id: 'verification',
            stepNumber: '02',
            title: 'Документы проверены',
            subtitle: 'Нужно дослать документы',
            state: 'attention',
            stateLabel: 'Требует внимания',
          },
          {
            id: 'commission',
            stepNumber: '03',
            title: 'К тестированию готов',
            subtitle: 'После сверки пакета',
            state: 'pending',
            stateLabel: 'На паузе',
          },
          {
            id: 'attestation',
            stepNumber: '04',
            title: 'Аттестован',
            subtitle: 'Сессия РЦА и реестр',
            state: 'pending',
            stateLabel: 'Ожидает',
          },
        ],
      };

    case 'in_review':
      return {
        statusKey: 'in_review',
        statusLabel: 'На рассмотрении аттестационной комиссии',
        statusSummary:
          customComment ||
          'Комиссия РЦА и ВВГУ проверяет походный стаж, медицинский допуск и соответствие заявленной категории сложности.',
        nextStepHint:
          'Ожидайте утверждения допуска к аттестации. Параллельно подготовьте паспорт маршрута (ПП № 760).',
        progressPercent: 55,
        completedStepsCount: 2,
        totalStepsCount: 4,
        activeStepNumber: 3,
        tone: 'teal',
        activeInquiry,
        steps: [
          {
            id: 'submitted',
            stepNumber: '01',
            title: 'Заявка подана',
            subtitle: 'Заявка зарегистрирована',
            state: 'completed',
            stateLabel: 'Выполнено',
          },
          {
            id: 'verification',
            stepNumber: '02',
            title: 'Документы проверены',
            subtitle: 'Базовый комплект принят',
            state: 'completed',
            stateLabel: 'Выполнено',
          },
          {
            id: 'commission',
            stepNumber: '03',
            title: 'К тестированию готов',
            subtitle: 'Экспертиза стажа и трека',
            state: 'current',
            stateLabel: 'На рассмотрении',
          },
          {
            id: 'attestation',
            stepNumber: '04',
            title: 'Аттестован',
            subtitle: 'Очная сессия и выдача',
            state: 'pending',
            stateLabel: 'Ожидает',
          },
        ],
      };

    case 'approved':
      if (isCertifiedUser) {
        return {
          statusKey: 'certified',
          statusLabel: 'Заявка одобрена · Аттестация завершена',
          statusSummary:
            customComment ||
            'Аттестация успешно пройдена, протокол комиссии подписан, запись внесена в федеральный реестр.',
          nextStepHint:
            'Вы можете скачать справку о статусе и открыть цифровой паспорт проводника.',
          progressPercent: 100,
          completedStepsCount: 4,
          totalStepsCount: 4,
          activeStepNumber: 4,
          tone: 'emerald',
          activeInquiry,
          steps: [
            {
              id: 'submitted',
              stepNumber: '01',
              title: 'Заявка подана',
              subtitle: 'Заявка зарегистрирована',
              state: 'completed',
              stateLabel: 'Выполнено',
            },
            {
              id: 'verification',
              stepNumber: '02',
              title: 'Документы проверены',
              subtitle: 'Комплект проверен',
              state: 'completed',
              stateLabel: 'Выполнено',
            },
            {
              id: 'commission',
              stepNumber: '03',
              title: 'К тестированию готов',
              subtitle: 'Заявка одобрена',
              state: 'completed',
              stateLabel: 'Выполнено',
            },
            {
              id: 'attestation',
              stepNumber: '04',
              title: 'Аттестован',
              subtitle: 'Свидетельство выдано',
              state: 'completed',
              stateLabel: 'Завершено',
            },
          ],
        };
      }

      return {
        statusKey: 'approved',
        statusLabel: 'Заявка одобрена · Допуск к экзамену открыт',
        statusSummary:
          customComment ||
          'Допуск к аттестационной сессии подтверждён. Вы можете проходить итоговое тестирование и полевой этап.',
        nextStepHint:
          'Завершите экзаменационные блоки по выбранной дате сессии для внесения сведений в федеральный реестр.',
        progressPercent: 75,
        completedStepsCount: 3,
        totalStepsCount: 4,
        activeStepNumber: 4,
        tone: 'emerald',
        activeInquiry,
        steps: [
          {
            id: 'submitted',
            stepNumber: '01',
            title: 'Заявка подана',
            subtitle: 'Заявка зарегистрирована',
            state: 'completed',
            stateLabel: 'Выполнено',
          },
          {
            id: 'verification',
            stepNumber: '02',
            title: 'Документы проверены',
            subtitle: 'Комплект подтверждён',
            state: 'completed',
            stateLabel: 'Выполнено',
          },
          {
            id: 'commission',
            stepNumber: '03',
            title: 'К тестированию готов',
            subtitle: 'Допуск к сессии открыт',
            state: 'completed',
            stateLabel: 'Одобрено',
          },
          {
            id: 'attestation',
            stepNumber: '04',
            title: 'Аттестован',
            subtitle: 'Сдача сессии и выдача',
            state: 'current',
            stateLabel: 'Финальный этап',
          },
        ],
      };

    case 'rejected':
      return {
        statusKey: 'rejected',
        statusLabel: 'Заявка отклонена · Требуется переоформление',
        statusSummary:
          customComment ||
          'Текущий комплект сведений не соответствует требованиям выбранного трека аттестации.',
        nextStepHint:
          'Уточните причину отклонения, скорректируйте данные о стаже и подайте новую заявку на ближайшую сессию.',
        progressPercent: 25,
        completedStepsCount: 1,
        totalStepsCount: 4,
        activeStepNumber: 2,
        tone: 'rose',
        activeInquiry,
        steps: [
          {
            id: 'submitted',
            stepNumber: '01',
            title: 'Заявка подана',
            subtitle: 'Заявка была подана',
            state: 'completed',
            stateLabel: 'Выполнено',
          },
          {
            id: 'verification',
            stepNumber: '02',
            title: 'Документы проверены',
            subtitle: 'Отклонено при сверке',
            state: 'rejected',
            stateLabel: 'Отклонено',
          },
          {
            id: 'commission',
            stepNumber: '03',
            title: 'К тестированию готов',
            subtitle: 'Приостановлено',
            state: 'pending',
            stateLabel: 'Остановлено',
          },
          {
            id: 'attestation',
            stepNumber: '04',
            title: 'Аттестован',
            subtitle: 'После повторной заявки',
            state: 'pending',
            stateLabel: 'Ожидает',
          },
        ],
      };
  }
}
