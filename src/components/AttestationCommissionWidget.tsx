import React, { useState } from 'react';
import { Award, CheckCircle2, Compass, MessageSquare, ShieldCheck } from 'lucide-react';
import { tracker } from '../utils/tracker';

export interface CommissionMember {
  id: string;
  name: string;
  role: string;
  institution: string;
  specialization: string;
  disciplines: string;
  experienceLabel: string;
  examScope: string;
  photoUrl: string;
  photoAlt: string;
  initials: string;
}

const COMMISSION_MEMBERS: CommissionMember[] = [
  {
    id: 'member-gomilevskaya',
    name: 'Галина Гомилевская',
    role: 'Председатель аттестационной комиссии',
    institution: 'Директор Института туризма и креативных индустрий ВВГУ',
    specialization: 'Правовое регулирование туризма, ДПО и защита паспортов маршрутов',
    disciplines: 'Законодательство РФ · ПП № 1003 / № 1893',
    experienceLabel: 'Руководитель отраслевых образовательных программ ВВГУ',
    examScope:
      'Возглавляет итоговое заседание комиссии, курирует соответствие программ переподготовки профессиональным стандартам, проверку паспортов маршрутов и взаимодействие с туроператорами ДФО.',
    photoUrl: '/src/assets/images/commission_chair_portrait_1795366115697.jpg',
    photoAlt: 'Галина Гомилевская — председатель аттестационной комиссии ВВГУ и РЦА «Русский Восток»',
    initials: 'ГГ',
  },
  {
    id: 'member-sarancha',
    name: 'Григорий Саранча',
    role: 'Руководитель РЦА «Русский Восток»',
    institution: 'Доцент кафедры туризма и ГРБ ВВГУ · Эксперт ФСТР',
    specialization: 'Организация полевой аттестации, горно-таёжный туризм и ПСР',
    disciplines: 'Пешеходный и горный туризм · 1–4 КС',
    experienceLabel: 'Координатор аттестационных сессий ДФО (окт. 2026: 26 аттестованных)',
    examScope:
      'Координирует приём заявок, зачёт подтверждённого походного стажа (Контур А) и проведение практических испытаний на полигонах Шкотовского района Приморского края.',
    photoUrl: '/src/assets/images/commission_head_portrait_1795366117334.jpg',
    photoAlt: 'Григорий Саранча — руководитель РЦА «Русский Восток» на горном маршруте Приморья',
    initials: 'ГС',
  },
  {
    id: 'member-morozova',
    name: 'Елена Морозова',
    role: 'Эксперт по безопасности ООПТ и первой помощи',
    institution: 'Координатор экотроп Сихотэ-Алиня и нацпарка «Бикин»',
    specialization: 'Wilderness First Aid, спутниковый трекинг и режимы ООПТ',
    disciplines: 'Первая помощь · Garmin inReach · Безопасность в ареале хищников',
    experienceLabel: 'Методист стандартов допуска групп в нацпарки Приморья',
    examScope:
      'Оценивает готовность соискателей к автономной первой помощи (WFA), работе со спутниковыми коммуникаторами, действиям при встрече с крупными хищниками и соблюдению режимов ООПТ.',
    photoUrl: '/src/assets/images/commission_oopt_portrait_1795366117184.jpg',
    photoAlt: 'Елена Морозова — эксперт комиссии по безопасности на ООПТ и первой помощи',
    initials: 'ЕМ',
  },
  {
    id: 'member-vereshchagin',
    name: 'Дмитрий Верещагин',
    role: 'Старший экзаменатор водного и полевого блока',
    institution: 'Инструктор-методист I категории ФСТР · Коллегия гидов ДФО',
    specialization: 'Спортивные сплавы, переправы и спасработы на горных реках',
    disciplines: 'Водный туризм · Спасработы на воде · 1–4 КС',
    experienceLabel: 'Наставник межрегиональных потоков (Приморье, Хабаровск, Камчатка)',
    examScope:
      'Принимает практический зачёт по гидрологии горных рек, организации навесных и водных переправ, работе со снаряжением и транспортировке пострадавшего на полевом полигоне.',
    photoUrl: '/src/assets/images/commission_water_portrait_1795366117595.jpg',
    photoAlt: 'Дмитрий Верещагин — старший экзаменатор по водному туризму и спасработам',
    initials: 'ДВ',
  },
];

interface AttestationCommissionWidgetProps {
  onContactCurator: (sourceLabel: string) => void;
}

export const AttestationCommissionWidget: React.FC<AttestationCommissionWidgetProps> = ({
  onContactCurator,
}) => {
  const [selectedId, setSelectedId] = useState<string>(COMMISSION_MEMBERS[0].id);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const activeMember =
    COMMISSION_MEMBERS.find((m) => m.id === selectedId) ?? COMMISSION_MEMBERS[0];

  const handleSelectMember = (member: CommissionMember) => {
    setSelectedId(member.id);
    tracker.trackCustomInteraction(`Комиссия РЦА: ${member.name}`, member.disciplines);
  };

  return (
    <section
      aria-labelledby="commission-widget-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Коллегиальная оценка ВВГУ и Федерации спортивного туризма России</span>
          </p>
          <h2 id="commission-widget-heading" className="text-xl font-bold text-slate-900">
            Эксперты аттестационной комиссии РЦА «Русский Восток»
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Экзамен принимают действующие преподаватели ВВГУ, сертифицированные инструкторы-методисты
            ФСТР и координаторы безопасности на ООПТ Дальнего Востока.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onContactCurator('Аттестационная комиссия')}
          className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <MessageSquare className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
          <span>Задать вопрос комиссии</span>
        </button>
      </div>

      {/* 4-column Experts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {COMMISSION_MEMBERS.map((member) => {
          const isSelected = member.id === activeMember.id;
          const imgFailed = failedImages[member.id];

          return (
            <button
              key={member.id}
              type="button"
              onClick={() => handleSelectMember(member)}
              aria-pressed={isSelected}
              className={`group text-left rounded-xl border overflow-hidden flex flex-col transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                isSelected
                  ? 'border-teal-700 bg-teal-50/40 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              {/* Portrait Frame (4:3 upper-body framing) */}
              <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden border-b border-slate-200">
                {!imgFailed ? (
                  <img
                    src={member.photoUrl}
                    alt={member.photoAlt}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [member.id]: true }))
                    }
                    className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-teal-900 flex flex-col items-center justify-center text-white gap-2">
                    <Compass className="w-7 h-7 text-teal-300" aria-hidden="true" />
                    <span className="text-lg font-bold font-mono">{member.initials}</span>
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-teal-800 leading-snug">
                    {member.role}
                  </p>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {member.name}
                  </h3>
                  <p className="text-xs text-slate-500 leading-snug">{member.institution}</p>
                </div>

                <div className="pt-2.5 border-t border-slate-200/80 space-y-1">
                  <p className="text-[11px] font-medium text-slate-500">Специализация</p>
                  <p className="text-xs font-medium text-slate-800 leading-relaxed">
                    {member.specialization}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Expert Detailed Examination Scope */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-8 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-teal-800">
              <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Зона оценки эксперта</span>
            </span>
            <span className="text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-slate-700">{activeMember.disciplines}</span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            {activeMember.name} — {activeMember.role.toLowerCase()}
          </h3>

          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {activeMember.examScope}
          </p>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-2 text-xs text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" aria-hidden="true" />
            <span className="leading-relaxed">{activeMember.experienceLabel}</span>
          </div>

          <button
            type="button"
            onClick={() =>
              onContactCurator(`Консультация по блоку: ${activeMember.name}`)
            }
            className="w-full px-3.5 py-2 bg-teal-50 border border-teal-200 text-teal-900 text-xs font-semibold rounded-lg hover:bg-teal-100 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Уточнить требования этапа</span>
          </button>
        </div>
      </div>
    </section>
  );
};
