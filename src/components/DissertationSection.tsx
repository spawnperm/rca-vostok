import React, { useState } from 'react';
import { DISSERTATION_DATA } from '../data/researchData';
import { DissertationPdfReader } from './DissertationPdfReader';

export const DissertationSection: React.FC = () => {
  const [degreeMode, setDegreeMode] = useState<'candidate' | 'doctor'>('candidate');

  return (
    <div className="space-y-12">
      {/* Header & Working Title */}
      <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span>Паспорт ВАК {DISSERTATION_DATA.specialty}</span>
            <span aria-hidden="true">·</span>
            <span>{DISSERTATION_DATA.specialization}</span>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setDegreeMode('candidate')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                degreeMode === 'candidate'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Кандидатский уровень
            </button>
            <button
              type="button"
              onClick={() => setDegreeMode('doctor')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                degreeMode === 'doctor'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Докторская перспектива
            </button>
          </div>
        </div>

        <blockquote className="font-serif text-xl sm:text-2xl font-semibold text-slate-900 leading-snug max-w-4xl py-2 border-y border-slate-200">
          {degreeMode === 'candidate'
            ? DISSERTATION_DATA.workingTitle
            : '«Трансформация системы профессиональной подготовки и сертификации кадров для сферы туризма Дальнего Востока в условиях цифровизации и нового нормативного регулирования»'}
        </blockquote>

        <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
          {degreeMode === 'candidate'
            ? 'Паспорт специальности 5.2.3 (область 4.15) прямо включает политику регулирования и поддержки развития отраслей сферы услуг. Исследование раскрывает институциональную природу разрыва между нормативной потребностью и способностью региональной системы подготовки её воспроизводить.'
            : 'Развёртывание кандидатского исследования до докторского уровня предполагает смену масштаба с Приморского края на весь Дальневосточный федеральный округ и переход от сегмента инструкторов-проводников к комплексной системе квалификаций (гиды-переводчики, экскурсоводы, персонал глэмпингов) с интеграцией международных стандартов.'}
        </p>
      </section>

      {/* Embedded Academic PDF Reader (Built-in & User-Uploaded PDFs) */}
      <DissertationPdfReader />

      {/* VAK Formal Requirements Comparison */}
      <section className="bg-white border border-slate-200 rounded-xl p-8 space-y-5">
        <div>
          <p className="text-xs font-medium text-teal-700">Нормативные критерии аттестационной комиссии</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            Сравнение требований ВАК: кандидатская vs докторская диссертация
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-3 pr-4">Критерий ВАК</th>
                <th className="py-3 px-4">Кандидатская диссертация</th>
                <th className="py-3 pl-4">Докторская диссертация</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {DISSERTATION_DATA.vakComparison.map((row) => (
                <tr key={row.criterion}>
                  <td className="py-3.5 pr-4 font-semibold text-slate-900 whitespace-nowrap">
                    {row.criterion}
                  </td>
                  <td
                    className={`py-3.5 px-4 text-xs leading-relaxed ${
                      degreeMode === 'candidate' ? 'text-slate-900 font-medium bg-teal-50/40' : 'text-slate-600'
                    }`}
                  >
                    {row.candidate}
                  </td>
                  <td
                    className={`py-3.5 pl-4 text-xs leading-relaxed ${
                      degreeMode === 'doctor' ? 'text-slate-900 font-medium bg-teal-50/40' : 'text-slate-600'
                    }`}
                  >
                    {row.doctor}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Object, Subject, Aim, Tasks + IFMGA Benchmark */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <h2 className="text-xl font-bold text-slate-900">
            Методологический каркас: объект, предмет, цель и задачи
          </h2>

          <dl className="space-y-4 text-sm">
            <div className="border-t border-slate-200 pt-3">
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Объект</dt>
              <dd className="mt-1 text-slate-800 leading-relaxed">{DISSERTATION_DATA.object}</dd>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Предмет</dt>
              <dd className="mt-1 text-slate-800 leading-relaxed">{DISSERTATION_DATA.subject}</dd>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Цель</dt>
              <dd className="mt-1 font-medium text-slate-900 leading-relaxed">{DISSERTATION_DATA.aim}</dd>
            </div>
          </dl>

          <div className="border-t border-slate-200 pt-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Шесть задач исследования
            </p>
            <ol className="space-y-2 text-xs text-slate-700">
              {DISSERTATION_DATA.tasks.map((task, idx) => (
                <li key={task} className="flex gap-3 leading-relaxed">
                  <span className="font-mono font-semibold text-teal-700 tabular-nums shrink-0">
                    0{idx + 1}.
                  </span>
                  <span>{task}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-5">
            <div>
              <p className="text-xs font-medium text-teal-700">Международная контрольная точка</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">
                Сравнение с системой IFMGA
              </h3>
            </div>

            <div className="space-y-4 text-xs leading-relaxed">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <p className="font-semibold text-slate-900">IFMGA (Международный стандарт)</p>
                <p className="text-slate-600">{DISSERTATION_DATA.ifmgaBenchmark.ifmga}</p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <p className="font-semibold text-slate-900">Российская модель (ПП № 1003 / № 1893)</p>
                <p className="text-slate-600">{DISSERTATION_DATA.ifmgaBenchmark.russia}</p>
              </div>
              <p className="text-slate-700 pt-2 border-t border-slate-200">
                {DISSERTATION_DATA.ifmgaBenchmark.insight}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
            <p className="text-xs font-medium text-teal-700">Публикационная стратегия ВАК</p>
            <h3 className="text-lg font-bold text-slate-900">План статей и апробации</h3>
            <div className="divide-y divide-slate-200 text-xs">
              {DISSERTATION_DATA.publicationsPlan.map((pub) => (
                <div key={pub.num} className="py-3 first:pt-1 last:pb-0 space-y-1">
                  <p className="font-mono font-semibold text-teal-700">{pub.num}</p>
                  <p className="text-slate-700 leading-relaxed">{pub.topic}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 pt-2 border-t border-slate-200">
              Площадки апробации: Тихоокеанский международный конгресс (ВВГУ), региональные конференции
              по туризму, методические семинары РЦА «Русский Восток».
            </p>
          </div>
        </div>
      </section>

      {/* Scientific Novelty (4 points) & Defense Propositions (4 points) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-5">
          <div>
            <p className="text-xs font-medium text-teal-700">Личный вклад соискателя</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Четыре пункта научной новизны
            </h2>
          </div>

          <div className="space-y-5">
            {DISSERTATION_DATA.novelty.map((item) => (
              <div key={item.num} className="border-t border-slate-200 pt-4 space-y-1.5">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-xs font-mono font-semibold text-teal-700 tabular-nums">
                    {item.num}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-6">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-5">
          <div>
            <p className="text-xs font-medium text-teal-700">Для диссертационного совета</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Положения, выносимые на защиту
            </h2>
          </div>

          <div className="space-y-4">
            {DISSERTATION_DATA.defensePropositions.map((prop, idx) => (
              <div
                key={prop}
                className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex gap-3.5 items-start"
              >
                <span className="font-mono text-xs font-bold text-teal-700 tabular-nums pt-0.5 shrink-0">
                  П{idx + 1}
                </span>
                <p className="font-serif text-sm text-slate-800 leading-relaxed">{prop}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
