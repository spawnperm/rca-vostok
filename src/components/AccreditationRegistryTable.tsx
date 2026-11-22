import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import {
  ACCREDITATION_REGISTRY_ENTRIES,
  filterAccreditationEntries,
  getAccreditationSummaryStats,
  type AccreditationRegistryEntry,
} from '../data/dfoOverviewRegistryData';
import { CENTER_ACCREDITATION_STATUS } from '../data/researchData';
import { tracker } from '../utils/tracker';

const renderStatusBadge = (entry: AccreditationRegistryEntry) => {
  if (entry.status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold whitespace-nowrap">
        <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" aria-hidden="true" />
        <span>{entry.statusLabel}</span>
      </span>
    );
  }
  if (entry.status === 'updated_2026') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50 border border-sky-200 text-sky-900 text-xs font-semibold whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-sky-700 shrink-0" aria-hidden="true" />
        <span>{entry.statusLabel}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
      <span>{entry.statusLabel}</span>
    </span>
  );
};

export const AccreditationRegistryTable: React.FC = () => {
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | AccreditationRegistryEntry['category']
  >('all');

  const summary = useMemo(() => getAccreditationSummaryStats(), []);
  const rows = useMemo(
    () => filterAccreditationEntries(categoryFilter),
    [categoryFilter]
  );

  return (
    <section
      aria-labelledby="accreditation-registry-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Лицензирование ВВГУ и полномочия РЦА по законодательству РФ</span>
          </p>
          <h2 id="accreditation-registry-heading" className="text-xl font-bold text-slate-900">
            Реестр аккредитации
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Сводная таблица лицензий, правовых оснований и действующих статусов деятельности
            Регионального центра аттестации «Русский Восток» на базе ФГБОУ ВО «ВВГУ».
          </p>
        </div>

        <a
          href={CENTER_ACCREDITATION_STATUS.officialPortal}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <span>Сверить на rca-vostok.ru</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
        </a>
      </div>

      {/* KPI Strip + Category Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
            <FileCheck2 className="w-4 h-4 text-teal-700" aria-hidden="true" />
            <span>
              Всего контуров: <strong className="font-mono tabular-nums">{summary.total}</strong>
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-teal-800 font-medium">
            <ShieldCheck className="w-4 h-4 text-teal-700" aria-hidden="true" />
            <span>
              Подтверждено и действует:{' '}
              <strong className="font-mono tabular-nums">{summary.verifiedCount}</strong>
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-800 font-medium">
            <Clock className="w-4 h-4 text-amber-700" aria-hidden="true" />
            <span>
              Проектное расширение:{' '}
              <strong className="font-mono tabular-nums">{summary.inProgressCount}</strong>
            </span>
          </span>
        </div>

        <div
          role="group"
          aria-label="Фильтр записей реестра аккредитации"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {(
            [
              { id: 'all', label: `Все записи (${ACCREDITATION_REGISTRY_ENTRIES.length})` },
              { id: 'education', label: 'Лицензия ДПО (ВВГУ)' },
              { id: 'attestation', label: 'Полномочия РЦА и ФСТР' },
              { id: 'registry', label: 'Реестр МЭР и ПДн' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setCategoryFilter(tab.id);
                tracker.trackCustomInteraction(`Реестр аккредитации: ${tab.label}`);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                categoryFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Registry Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-3.5 px-4 min-w-[240px]">Документ / Правовой контур</th>
              <th className="py-3.5 px-4 min-w-[190px]">Норма РФ и реквизиты</th>
              <th className="py-3.5 px-4 min-w-[170px]">Надзорный орган / Оператор</th>
              <th className="py-3.5 px-4 min-w-[240px]">Область действия и срок</th>
              <th className="py-3.5 px-4 whitespace-nowrap">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs sm:text-sm bg-white">
            {rows.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors align-top">
                <td className="py-4 px-4 space-y-1">
                  <p className="text-[11px] font-semibold text-teal-700">{entry.categoryLabel}</p>
                  <p className="font-semibold text-slate-900 leading-snug">{entry.documentName}</p>
                </td>

                <td className="py-4 px-4 space-y-1">
                  <p className="font-mono text-xs font-semibold text-slate-800">
                    {entry.legalNorm}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-snug">{entry.registryNumber}</p>
                </td>

                <td className="py-4 px-4 text-xs text-slate-700 font-medium leading-snug">
                  {entry.issuingAuthority}
                </td>

                <td className="py-4 px-4 space-y-1.5">
                  <p className="text-xs text-slate-600 leading-relaxed">{entry.scopeAndTerms}</p>
                  <p className="text-[11px] font-mono text-slate-700">
                    Срок действия: <span className="font-semibold">{entry.validUntil}</span>
                  </p>
                </td>

                <td className="py-4 px-4 whitespace-nowrap">{renderStatusBadge(entry)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
