import React, { useMemo } from 'react';
import { ArrowLeftRight, FileSpreadsheet, FileText, Table2 } from 'lucide-react';
import { DFO_REGIONS_DISTRIBUTION, type DfoRegionDistribution } from '../data/researchData';
import { getRegionDemand2030 } from '../utils/dfoReportExport';
import { tracker } from '../utils/tracker';

const QUICK_COMPARE_PAIRS: { label: string; a: string; b: string }[] = [
  { label: 'Приморье vs Камчатка', a: 'primorye', b: 'kamchatka' },
  { label: 'Приморье vs Хабаровск', a: 'primorye', b: 'khabarovsk' },
  { label: 'Камчатка vs Сахалин', a: 'kamchatka', b: 'sakhalin' },
  { label: 'Хабаровск vs Якутия', a: 'khabarovsk', b: 'yakutia' },
];

interface DfoRegionsComparisonTableProps {
  regionAId: string;
  regionBId: string;
  onChangeRegionA: (regionId: string) => void;
  onChangeRegionB: (regionId: string) => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
}

interface ComparisonRow {
  id: string;
  label: string;
  hint: string;
  valA: number;
  valB: number;
  format: (v: number) => string;
  formatDiff: (diff: number) => string;
  higherIsBetter: 'positive' | 'deficit' | 'neutral';
}

export const DfoRegionsComparisonTable: React.FC<DfoRegionsComparisonTableProps> = ({
  regionAId,
  regionBId,
  onChangeRegionA,
  onChangeRegionB,
  onExportCsv,
  onExportPdf,
}) => {
  const regionA: DfoRegionDistribution = useMemo(
    () =>
      DFO_REGIONS_DISTRIBUTION.find((r) => r.id === regionAId) ?? DFO_REGIONS_DISTRIBUTION[0],
    [regionAId]
  );

  const regionB: DfoRegionDistribution = useMemo(
    () =>
      DFO_REGIONS_DISTRIBUTION.find((r) => r.id === regionBId) ?? DFO_REGIONS_DISTRIBUTION[1],
    [regionBId]
  );

  const totalRegistry = useMemo(
    () => DFO_REGIONS_DISTRIBUTION.reduce((sum, r) => sum + r.certifiedInRegistry, 0),
    []
  );

  const rows: ComparisonRow[] = useMemo(() => {
    const deficitA = Math.max(0, regionA.estimatedDemand - regionA.certifiedInRegistry);
    const deficitB = Math.max(0, regionB.estimatedDemand - regionB.certifiedInRegistry);

    const covA =
      regionA.estimatedDemand > 0
        ? Math.round((regionA.certifiedInRegistry / regionA.estimatedDemand) * 1000) / 10
        : 0;
    const covB =
      regionB.estimatedDemand > 0
        ? Math.round((regionB.certifiedInRegistry / regionB.estimatedDemand) * 1000) / 10
        : 0;

    const shareA =
      totalRegistry > 0
        ? Math.round((regionA.certifiedInRegistry / totalRegistry) * 1000) / 10
        : 0;
    const shareB =
      totalRegistry > 0
        ? Math.round((regionB.certifiedInRegistry / totalRegistry) * 1000) / 10
        : 0;

    const demand2030A = getRegionDemand2030(regionA.id);
    const demand2030B = getRegionDemand2030(regionB.id);

    const fmtPeople = (n: number) => `${n.toLocaleString('ru-RU')} чел.`;
    const fmtSignedPeople = (d: number) =>
      `${d > 0 ? '+' : ''}${d.toLocaleString('ru-RU')} чел.`;
    const fmtPct = (n: number) => `${n}%`;
    const fmtSignedPct = (d: number) => {
      const rounded = Math.round(d * 10) / 10;
      return `${rounded > 0 ? '+' : ''}${rounded} п.п.`;
    };

    return [
      {
        id: 'certified',
        label: 'Аттестованные проводники в реестре',
        hint: 'Специалисты с действующей записью в Едином федеральном реестре',
        valA: regionA.certifiedInRegistry,
        valB: regionB.certifiedInRegistry,
        format: fmtPeople,
        formatDiff: fmtSignedPeople,
        higherIsBetter: 'positive',
      },
      {
        id: 'demand',
        label: 'Расчётный спрос на проводников (2025)',
        hint: 'Потребность активного сегмента с учётом групповой нагрузки',
        valA: regionA.estimatedDemand,
        valB: regionB.estimatedDemand,
        format: fmtPeople,
        formatDiff: fmtSignedPeople,
        higherIsBetter: 'neutral',
      },
      {
        id: 'deficit',
        label: 'Кадровый дефицит (спрос минус реестр)',
        hint: 'Незакрытая потребность субъекта ДФО в аттестованных гидах',
        valA: deficitA,
        valB: deficitB,
        format: fmtPeople,
        formatDiff: fmtSignedPeople,
        higherIsBetter: 'deficit',
      },
      {
        id: 'coverage',
        label: 'Покрытие расчётного спроса реестром',
        hint: 'Доля текущей потребности, обеспеченная аттестованными кадрами',
        valA: covA,
        valB: covB,
        format: fmtPct,
        formatDiff: fmtSignedPct,
        higherIsBetter: 'positive',
      },
      {
        id: 'october',
        label: 'Выпуск на сессии РЦА (окт. 2026)',
        hint: 'Прошли аттестацию на площадке РЦА «Русский Восток» (ВВГУ)',
        valA: regionA.october2026Certified,
        valB: regionB.october2026Certified,
        format: fmtPeople,
        formatDiff: fmtSignedPeople,
        higherIsBetter: 'positive',
      },
      {
        id: 'share',
        label: 'Доля от общего реестра ДФО',
        hint: `От совокупных ${totalRegistry} аттестованных специалистов макрорегиона`,
        valA: shareA,
        valB: shareB,
        format: fmtPct,
        formatDiff: fmtSignedPct,
        higherIsBetter: 'neutral',
      },
      {
        id: 'forecast2030',
        label: 'Прогнозный спрос к 2030 г. (базовый)',
        hint: 'Модельная траектория ВВГУ с учётом роста турпотока ДФО',
        valA: demand2030A,
        valB: demand2030B,
        format: fmtPeople,
        formatDiff: fmtSignedPeople,
        higherIsBetter: 'neutral',
      },
    ];
  }, [regionA, regionB, totalRegistry]);

  const handleSwap = () => {
    const prevA = regionA.id;
    const prevB = regionB.id;
    onChangeRegionA(prevB);
    onChangeRegionB(prevA);
    tracker.trackCustomInteraction(`Таблица сравнения ДФО: смена ${regionB.shortName} ↔ ${regionA.shortName}`);
  };

  return (
    <section
      aria-labelledby="dfo-pair-table-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Quick Export Actions */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Table2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Табличное сопоставление показателей аттестации</span>
          </p>
          <h2 id="dfo-pair-table-heading" className="text-lg sm:text-xl font-bold text-slate-900">
            Сравнение двух выбранных регионов ДФО: реестр, спрос и дефицит
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Выберите два субъекта Дальнего Востока для наглядного сопоставления числа аттестованных
            гидов, расчётной потребности, кадрового разрыва и прогноза до 2030 года.
          </p>
        </div>

        {(onExportCsv || onExportPdf) && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onExportPdf && (
              <button
                type="button"
                onClick={onExportPdf}
                className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-teal-300" aria-hidden="true" />
                <span>Скачать PDF</span>
              </button>
            )}
            {onExportCsv && (
              <button
                type="button"
                onClick={onExportCsv}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                <span>Скачать CSV</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Region Pair Controls */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-end">
          <div className="md:col-span-5 space-y-1.5">
            <label
              htmlFor="cmp-table-region-a"
              className="flex items-center gap-2 text-xs font-semibold text-slate-700"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-teal-700 shrink-0" aria-hidden="true" />
              <span>Регион А (базовый столбец)</span>
            </label>
            <select
              id="cmp-table-region-a"
              value={regionA.id}
              onChange={(e) => {
                onChangeRegionA(e.target.value);
                tracker.trackCustomInteraction(`Таблица сравнения ДФО · А: ${e.target.value}`);
              }}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
            >
              {DFO_REGIONS_DISTRIBUTION.map((reg) => (
                <option key={`a-${reg.id}`} value={reg.id}>
                  {reg.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1 flex justify-center">
            <button
              type="button"
              onClick={handleSwap}
              aria-label="Поменять регионы местами"
              title="Поменять регионы местами"
              className="p-2.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="md:col-span-5 space-y-1.5">
            <label
              htmlFor="cmp-table-region-b"
              className="flex items-center gap-2 text-xs font-semibold text-slate-700"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0" aria-hidden="true" />
              <span>Регион Б (сравниваемый)</span>
            </label>
            <select
              id="cmp-table-region-b"
              value={regionB.id}
              onChange={(e) => {
                onChangeRegionB(e.target.value);
                tracker.trackCustomInteraction(`Таблица сравнения ДФО · Б: ${e.target.value}`);
              }}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
            >
              {DFO_REGIONS_DISTRIBUTION.map((reg) => (
                <option key={`b-${reg.id}`} value={reg.id}>
                  {reg.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Preset Pairs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 text-xs">
          <span className="text-slate-500 font-medium">Быстрые пары:</span>
          {QUICK_COMPARE_PAIRS.map((pair) => {
            const isActive = regionA.id === pair.a && regionB.id === pair.b;
            return (
              <button
                key={pair.label}
                type="button"
                onClick={() => {
                  onChangeRegionA(pair.a);
                  onChangeRegionB(pair.b);
                  tracker.trackCustomInteraction(`Таблица сравнения ДФО: ${pair.label}`);
                }}
                className={`px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                {pair.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Comparison Data Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <th className="py-3.5 px-4 min-w-[230px]">Показатель аттестации</th>
              <th className="py-3.5 px-4 text-right whitespace-nowrap min-w-[140px]">
                <span className="inline-flex items-center justify-end gap-1.5 text-teal-800">
                  <span className="w-2 h-2 rounded-full bg-teal-700" aria-hidden="true" />
                  {regionA.shortName}
                </span>
              </th>
              <th className="py-3.5 px-4 text-right whitespace-nowrap min-w-[140px]">
                <span className="inline-flex items-center justify-end gap-1.5 text-amber-800">
                  <span className="w-2 h-2 rounded-full bg-amber-600" aria-hidden="true" />
                  {regionB.shortName}
                </span>
              </th>
              <th className="py-3.5 px-4 text-right whitespace-nowrap min-w-[145px]">
                Разница (А − Б)
              </th>
              <th className="py-3.5 px-4 min-w-[170px] hidden sm:table-cell">
                Соотношение объёмов
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
            {rows.map((row) => {
              const diff = row.valA - row.valB;
              const maxVal = Math.max(row.valA, row.valB, 1);
              const pctA = Math.round((row.valA / maxVal) * 100);
              const pctB = Math.round((row.valB / maxVal) * 100);

              let diffClass = 'text-slate-700';
              if (diff !== 0) {
                if (row.higherIsBetter === 'positive') {
                  diffClass = diff > 0 ? 'text-teal-800' : 'text-amber-800';
                } else if (row.higherIsBetter === 'deficit') {
                  diffClass = diff > 0 ? 'text-red-700' : 'text-teal-800';
                }
              }

              const ratioText =
                row.valA > 0 && row.valB > 0
                  ? `${(Math.max(row.valA, row.valB) / Math.min(row.valA, row.valB)).toFixed(1)}×`
                  : '—';

              return (
                <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 align-top">
                    <p className="font-semibold text-slate-900">{row.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{row.hint}</p>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-teal-800 tabular-nums whitespace-nowrap align-top">
                    {row.format(row.valA)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-800 tabular-nums whitespace-nowrap align-top">
                    {row.format(row.valB)}
                  </td>
                  <td
                    className={`py-3.5 px-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap align-top ${diffClass}`}
                  >
                    <span>{row.formatDiff(diff)}</span>
                    {ratioText !== '—' && diff !== 0 && (
                      <span className="block text-[11px] font-normal text-slate-500 mt-0.5">
                        разрыв {ratioText}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 hidden sm:table-cell align-middle">
                    <div className="space-y-1.5">
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-700 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(pctA, row.valA > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-600 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(pctB, row.valB > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Qualitative Tracks Comparison Row */}
            <tr className="bg-slate-50/60">
              <td className="py-3.5 px-4 align-top">
                <p className="font-semibold text-slate-900">Специфика маршрутов и статус</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Профильные направления подготовки проводников
                </p>
              </td>
              <td className="py-3.5 px-4 text-right align-top">
                <p className="text-xs font-semibold text-slate-900">{regionA.statusLabel}</p>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{regionA.keyTracks}</p>
              </td>
              <td className="py-3.5 px-4 text-right align-top">
                <p className="text-xs font-semibold text-slate-900">{regionB.statusLabel}</p>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{regionB.keyTracks}</p>
              </td>
              <td colSpan={2} className="py-3.5 px-4 text-xs text-slate-600 align-top">
                {regionA.id === regionB.id
                  ? 'Выбран один и тот же регион — укажите разные субъекты для сопоставления.'
                  : `${regionA.shortName}: ${regionA.note}`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
};
