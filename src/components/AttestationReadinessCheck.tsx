import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { tracker } from '../utils/tracker';

type TrackProfileId = 'hiking' | 'water' | 'expedition';

interface ReadinessItem {
  id: string;
  title: string;
  critical: boolean;
  category: 'Документы и допуск' | 'Опыт и практика' | 'Снаряжение и экзамен';
  descriptionByTrack: Record<TrackProfileId, string>;
}

const TRACK_PROFILES: { id: TrackProfileId; label: string; hint: string }[] = [
  {
    id: 'hiking',
    label: 'Пешеходный туризм',
    hint: 'Экотропы ООПТ, горные треки 1–4 КС, полигон Шкотовского района',
  },
  {
    id: 'water',
    label: 'Водный туризм и сплавы',
    hint: 'Горные реки, морской каякинг, SUP, спасработы на воде',
  },
  {
    id: 'expedition',
    label: 'Горный / экспедиционный',
    hint: 'Автономные маршруты 2–4 КС, малые группы 4–6 чел., Камчатка и Север',
  },
];

const READINESS_ITEMS: ReadinessItem[] = [
  {
    id: 'medical',
    title: 'Медицинская справка-допуск',
    critical: true,
    category: 'Документы и допуск',
    descriptionByTrack: {
      hiking:
        'Действующее медицинское заключение об отсутствии противопоказаний к физическим нагрузкам и сопровождению групп.',
      water:
        'Медсправка-допуск с учётом водных нагрузок, переохлаждения и проведения спасательных работ на течении.',
      expedition:
        'Действующая медсправка-допуск для высокогорья, длительной автономии и экстремальных температур.',
    },
  },
  {
    id: 'experience',
    title: 'Подтверждённый походный или коммерческий опыт',
    critical: true,
    category: 'Опыт и практика',
    descriptionByTrack: {
      hiking:
        'Маршрутные книжки, справки ФСТР или договоры/характеристики туроператора (зачёт по Контуру А ВВГУ).',
      water:
        'Подтверждение участия/руководства водными сплавами заявленной категории сложности (справки или договоры).',
      expedition:
        'Документированный ценз автономных походов (справки МКК, ФСТР, треки экспедиций по заявленной КС).',
    },
  },
  {
    id: 'equipment',
    title: 'Личное и групповое снаряжение по профилю',
    critical: true,
    category: 'Снаряжение и экзамен',
    descriptionByTrack: {
      hiking:
        'Треккинговая обувь, штормовая одежда, компас/навигатор, верёвка для переправ и укомплектованная аптечка на полигон.',
      water:
        'Спасжилет, каска, гидрокостюм/сухой костюм, спасконец («морковка»), стропорез и герметичная аптечка.',
      expedition:
        'Бивачное и страховочное снаряжение по КС, спутниковый трекер (Garmin inReach) и расширенная аптечка WFA.',
    },
  },
  {
    id: 'identity-docs',
    title: 'Паспорт РФ, СНИЛС и документ об образовании (или ДПО)',
    critical: true,
    category: 'Документы и допуск',
    descriptionByTrack: {
      hiking:
        'Базовый пакет для регистрации соискателя и передачи сведений в Единый федеральный реестр Минэкономразвития РФ.',
      water:
        'Базовый пакет документов + диплом о ДПО (или заявка на договорной поток водного туризма ВВГУ).',
      expedition:
        'Базовый пакет документов + диплом о профессиональном образовании или переподготовке ВВГУ.',
    },
  },
  {
    id: 'route-passport',
    title: 'Подготовлен проект паспорта маршрута (ПП № 760)',
    critical: false,
    category: 'Снаряжение и экзамен',
    descriptionByTrack: {
      hiking:
        'Описание нитки маршрута, контрольных сроков, точек связи/эвакуации и режима ООПТ к защите на теории в ВВГУ.',
      water:
        'Лоция участка реки, оценка паводковых рисков, точки страховки с берега и схема эвакуации.',
      expedition:
        'Полный паспорт автономного маршрута с планом ПСР, точками вертолётной эвакуации и контрольными сеансами связи.',
    },
  },
  {
    id: 'wfa-safety',
    title: 'Навыки первой помощи (WFA) и протоколов ДФО',
    critical: false,
    category: 'Опыт и практика',
    descriptionByTrack: {
      hiking:
        'Базовые и автономные приёмы первой помощи, ориентирование и регламент действий при встрече с тигром или медведем.',
      water:
        'Помощь при утоплении и гипотермии, спасение с воды, организация переправ и работа в зоне хищников.',
      expedition:
        'Протокол Wilderness First Aid (WFA), спутниковый вызов ПСР и профилактика конфликтов с крупными хищниками.',
    },
  },
];

interface AttestationReadinessCheckProps {
  onContactCurator?: (sourceLabel: string) => void;
}

export const AttestationReadinessCheck: React.FC<AttestationReadinessCheckProps> = ({
  onContactCurator,
}) => {
  const [selectedTrack, setSelectedTrack] = useState<TrackProfileId>('hiking');
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({
    medical: false,
    experience: false,
    equipment: false,
    'identity-docs': false,
    'route-passport': false,
    'wfa-safety': false,
  });

  const activeTrack =
    TRACK_PROFILES.find((t) => t.id === selectedTrack) ?? TRACK_PROFILES[0];

  const totalCount = READINESS_ITEMS.length;
  const checkedCount = useMemo(
    () => READINESS_ITEMS.filter((item) => checkedIds[item.id]).length,
    [checkedIds]
  );
  const missingItems = useMemo(
    () => READINESS_ITEMS.filter((item) => !checkedIds[item.id]),
    [checkedIds]
  );
  const missingCritical = useMemo(
    () => missingItems.filter((item) => item.critical),
    [missingItems]
  );

  const progressPct = Math.round((checkedCount / totalCount) * 100);

  const readinessStatus = useMemo(() => {
    if (checkedCount === totalCount) {
      return {
        tier: 'ready' as const,
        badge: 'Предварительно готов к аттестации',
        title: 'Комплект и базовые требования подтверждены (6 из 6)',
        summary:
          'Вы можете подавать документы на ближайшую экзаменационную сессию РЦА «Русский Восток» в ВВГУ и выходить на защиту паспорта маршрута.',
        nextStep:
          'Направьте заявку куратору РЦА для включения в график теоретического тестирования и полевых испытаний в Шкотовском районе.',
        borderClass: 'border-teal-300 bg-teal-50/70',
        badgeClass: 'bg-teal-700 text-white',
        progressClass: 'bg-teal-700',
      };
    }
    if (checkedCount >= 3 && missingCritical.length <= 1) {
      return {
        tier: 'partial' as const,
        badge: 'Частичная готовность · Нужна доработка',
        title: `Выполнено ${checkedCount} из ${totalCount} требований`,
        summary:
          missingCritical.length === 1
            ? `Для допуска к экзамену осталось закрыть обязательный пункт: «${missingCritical[0].title}».`
            : 'Обязательные документы собраны — осталось подготовить практические и экзаменационные блоки перед сессией.',
        nextStep:
          'При наличии опыта без формальных справок воспользуйтесь ускоренным Контуром А ВВГУ или проверьте пакет у куратора.',
        borderClass: 'border-amber-300 bg-amber-50/70',
        badgeClass: 'bg-amber-700 text-white',
        progressClass: 'bg-amber-600',
      };
    }
    return {
      tier: 'early' as const,
      badge: 'Начальная подготовка',
      title:
        checkedCount === 0
          ? 'Отметьте выполненные пункты для оценки готовности'
          : `Выполнено ${checkedCount} из ${totalCount} требований`,
      summary:
        checkedCount === 0
          ? 'Проставьте галочки напротив документов, опыта и снаряжения, которые уже есть на руках, чтобы получить предварительный статус допуска.'
          : 'Недостаёт нескольких обязательных требований для допуска к комиссии. Рекомендуется предварительная сверка документов или обучение по программе ДПО ВВГУ.',
      nextStep:
        'Начните с оформления медицинской справки-допуска и сверки походного стажа по Контуру А / базовому курсу ВВГУ.',
      borderClass: 'border-slate-200 bg-slate-50',
      badgeClass: 'bg-slate-800 text-white',
      progressClass: checkedCount > 0 ? 'bg-slate-700' : 'bg-slate-300',
    };
  }, [checkedCount, missingCritical, totalCount]);

  const toggleItem = (item: ReadinessItem) => {
    setCheckedIds((prev) => {
      const nextValue = !prev[item.id];
      const next = { ...prev, [item.id]: nextValue };
      const nextTotal = READINESS_ITEMS.filter((i) => next[i.id]).length;
      tracker.trackCustomInteraction(
        `Самопроверка готовности: ${item.title}`,
        `${nextValue ? 'отмечено' : 'снято'} (${nextTotal}/${totalCount})`
      );
      return next;
    });
  };

  const resetAll = () => {
    setCheckedIds({
      medical: false,
      experience: false,
      equipment: false,
      'identity-docs': false,
      'route-passport': false,
      'wfa-safety': false,
    });
    tracker.trackCustomInteraction('Самопроверка готовности: сброс');
  };

  return (
    <section
      aria-labelledby="readiness-check-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Track Selector */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
            <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Экспресс-диагностика соискателя</span>
          </div>
          <h2 id="readiness-check-heading" className="text-xl font-bold text-slate-900">
            Самопроверка готовности к аттестации
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Отметьте имеющиеся документы, подтверждённый опыт и снаряжение по выбранному виду
            туризма, чтобы получить предварительный статус допуска к ближайшей сессии РЦА.
          </p>
        </div>

        <div
          role="group"
          aria-label="Вид туризма для самопроверки"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {TRACK_PROFILES.map((tp) => {
            const active = tp.id === selectedTrack;
            return (
              <button
                key={tp.id}
                type="button"
                onClick={() => {
                  setSelectedTrack(tp.id);
                  tracker.trackCustomInteraction(`Самопроверка профиль: ${tp.label}`);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tp.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Checklist (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pb-1">
            <span>Профиль: {activeTrack.hint}</span>
            {checkedCount > 0 && (
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>Сбросить</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
            {READINESS_ITEMS.map((item) => {
              const checked = Boolean(checkedIds[item.id]);
              return (
                <label
                  key={item.id}
                  className={`flex items-start gap-3.5 p-4 transition-colors cursor-pointer select-none ${
                    checked ? 'bg-teal-50/50' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleItem(item)}
                    className="mt-0.5 w-4 h-4 accent-teal-700 rounded cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`text-sm font-semibold leading-snug ${
                          checked ? 'text-teal-950' : 'text-slate-900'
                        }`}
                      >
                        {item.title}
                      </span>
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                          item.critical
                            ? 'bg-slate-100 border-slate-200 text-slate-700'
                            : 'bg-white border-slate-200 text-slate-500'
                        }`}
                      >
                        {item.critical ? 'Обязательно' : 'Экзамен'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.descriptionByTrack[selectedTrack]}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Live Status Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className={`border rounded-xl p-6 space-y-4 transition-colors ${readinessStatus.borderClass}`}>
            <div className="flex items-center justify-between gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md ${readinessStatus.badgeClass}`}
              >
                {readinessStatus.tier === 'ready' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                ) : readinessStatus.tier === 'partial' ? (
                  <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>{readinessStatus.badge}</span>
              </span>

              <span className="text-sm font-mono font-bold text-slate-900 tabular-nums">
                {progressPct}%
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="h-2 w-full bg-white/80 border border-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${readinessStatus.progressClass}`}
                  style={{ width: `${Math.max(progressPct, 3)}%` }}
                />
              </div>
              <p className="text-xs font-medium text-slate-600 tabular-nums">
                Отмечено: {checkedCount} из {totalCount} пунктов
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <h3 className="text-base font-bold text-slate-900 leading-snug">
                {readinessStatus.title}
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                {readinessStatus.summary}
              </p>
            </div>

            {missingItems.length > 0 && (
              <div className="pt-3 border-t border-slate-200/80 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Осталось подготовить ({missingItems.length})
                </p>
                <ul className="space-y-1 text-xs text-slate-700">
                  {missingItems.map((m) => (
                    <li key={m.id} className="flex items-start gap-1.5">
                      <span className="text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span>
                        {m.title}
                        {m.critical && (
                          <span className="text-red-700 font-medium"> (обязательно)</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200/80 space-y-3">
              <p className="text-xs text-slate-700 leading-relaxed">
                <span className="font-semibold text-slate-900">Рекомендуемый шаг: </span>
                {readinessStatus.nextStep}
              </p>

              {onContactCurator && (
                <button
                  type="button"
                  onClick={() =>
                    onContactCurator(
                      `Самопроверка готовности (${activeTrack.label}: ${checkedCount}/${totalCount})`
                    )
                  }
                  className="w-full px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
                  <span>Сверить допуск и документы с куратором</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
