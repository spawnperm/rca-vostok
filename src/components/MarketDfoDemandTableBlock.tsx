import React, { useMemo, useState } from 'react';
import { Table2 } from 'lucide-react';
import { DFO_REGIONS_DISTRIBUTION } from '../data/researchData';
import {
  buildDfoDemandComparisonRows,
  getDfoHorizonLabel,
  type DfoDemandComparisonHorizon,
} from '../utils/dfoDemandComparison';
import { tracker } from '../utils/tracker';

export const MarketDfoDemandTableBlock: React.FC = () => {
  const [baselineRegionId, setBaselineRegionId] = useState<string>('primorye');
  const [horizon, setHorizon] = useState<DfoDemandComparisonHorizon>('current');

  const comparison = useMemo(
    () => buildDfoDemandComparisonRows(baselineRegionId, horizon),
    [baselineRegionId, horizon]
  );

  const horizonLabel = getDfoHorizonLabel(horizon);

  const handleChangeBaseline = (nextId: string) => {
    setBaselineRegionId(nextId);
    const matched = DFO_REGIONS_DISTRIBUTION.find((r) => r.id === nextId);
    tracker.trackCustomInteraction(
      'Таблица потребности ДФО: выбор опорного региона',
      matched?.shortName ?? nextId
    );
  };

  const handleChangeHorizon = (nextHorizon: DfoDemandComparisonHorizon) => {
    setHorizon(nextHorizon);
    tracker.trackCustomInteraction(
      'Таблица потребности ДФО: горизонт расчёта',
      getDfoHorizonLabel(nextHorizon)
    );
  };

  return (
    <section
      aria-labelledby="market-dfo-demand-table-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Section Heading & Dropdown Selectors */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <Table2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Межрегиональная матрица потребности в кадрах</span>
          </p>
          <h2
            id="market-dfo-demand-table-heading"
            className="text-xl font-bold text-slate-900"
          >
            Сравнение потребности в инструкторах по регионам ДФО
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Выберите опорный регион Дальнего Востока в выпадающем списке — таблица автоматически
            пересчитает разницу в потребности, кадровом дефиците и обеспеченности относительно
            выбранного субъекта.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full xl:w-auto xl:min-w-[460px]">
          <div className="space-y-1">
            <label
              htmlFor="market-demand-baseline-select"
              className="block text-xs font-semibold text-slate-700"
            >
              Опорный регион ДФО
            </label>
            <select
              id="market-demand-baseline-select"
              value={baselineRegionId}
              onChange={(e) => handleChangeBaseline(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-2 focus:outline-teal-700 cursor-pointer"
            >
              {DFO_REGIONS_DISTRIBUTION.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="market-demand-horizon-select"
              className="block text-xs font-semibold text-slate-700"
            >
              Показатель для сравнения
            </label>
            <select
              id="market-demand-horizon-select"
              value={horizon}
              onChange={(e) =>
                handleChangeHorizon(e.target.value as DfoDemandComparisonHorizon)
              }
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-2 focus:outline-teal-700 cursor-pointer"
            >
              <option value="current">Текущий спрос (2025–2026 гг.)</option>
              <option value="forecast_2030_base">Прогноз потребности 2030 (базовый)</option>
              <option value="forecast_2030_conservative">
                Прогноз потребности 2030 (консервативный)
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Selected Baseline Quick Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] text-slate-500">Выбранный опорный регион</p>
          <p className="mt-1 text-sm font-bold text-slate-900 truncate">
            {comparison.baseline.region.name}
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] text-slate-500">{horizonLabel}</p>
          <p className="mt-1 text-lg font-bold font-mono text-teal-800 tabular-nums">
            {comparison.baseline.activeDemandValue.toLocaleString('ru-RU')} чел.
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] text-slate-500">Дефицит (при текущем реестре)</p>
          <p className="mt-1 text-lg font-bold font-mono text-red-700 tabular-nums">
            {comparison.baseline.deficit.toLocaleString('ru-RU')} чел.
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] text-slate-500">Потребность всего ДФО</p>
          <p className="mt-1 text-lg font-bold font-mono text-slate-900 tabular-nums">
            {comparison.totals.activeDemandValue.toLocaleString('ru-RU')} чел.
          </p>
        </div>
      </div>

      {/* Clean Simple Comparison Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <th className="py-3.5 px-4 min-w-[210px]">Субъект ДФО</th>
              <th className="py-3.5 px-4 text-right whitespace-nowrap">В реестре</th>
              <th className="py-3.5 px-4 text-right whitespace-nowrap">{horizonLabel}</th>
              <th className="py-3.5 px-4 text-right whitespace-nowrap">Дефицит</th>
              <th className="py-3.5 px-4 text-right whitespace-nowrap">Покрытие</th>
              <th className="py-3.5 px-4 text-right whitespace-nowrap">
                Разница с «{comparison.baseline.region.shortName}»
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
            {comparison.rows.map((row) => {
              const delta = row.deltaFromBaseline;
              const deltaFormatted =
                delta === 0
                  ? 'Опорный (0)'
                  : `${delta > 0 ? '+' : ''}${delta.toLocaleString('ru-RU')} чел.`;

              return (
                <tr
                  key={row.region.id}
                  onClick={() => handleChangeBaseline(row.region.id)}
                  className={`transition-colors cursor-pointer ${
                    row.isBaseline
                      ? 'bg-teal-50/70 font-semibold'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  <td className="py-3 px-4 text-slate-900">
                    <span>{row.region.name}</span>
                    {row.isBaseline && (
                      <span className="text-xs font-medium text-teal-800"> · выбран</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {row.certifiedInRegistry.toLocaleString('ru-RU')} чел.
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                    {row.activeDemandValue.toLocaleString('ru-RU')} чел.
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-red-700 whitespace-nowrap">
                    {row.deficit.toLocaleString('ru-RU')} чел.
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {row.coveragePct}%
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap ${
                      row.isBaseline
                        ? 'text-teal-800 font-semibold'
                        : delta > 0
                          ? 'text-amber-800 font-medium'
                          : 'text-slate-600'
                    }`}
                  >
                    {deltaFormatted}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200 text-xs sm:text-sm font-bold text-slate-900">
              <td className="py-3.5 px-4">Итого по ДФО (7 субъектов)</td>
              <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                {comparison.totals.certifiedInRegistry.toLocaleString('ru-RU')} чел.
              </td>
              <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                {comparison.totals.activeDemandValue.toLocaleString('ru-RU')} чел.
              </td>
              <td className="py-3.5 px-4 text-right font-mono tabular-nums text-red-700 whitespace-nowrap">
                {comparison.totals.deficit.toLocaleString('ru-RU')} чел.
              </td>
              <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                {comparison.totals.coveragePct}%
              </td>
              <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                Доля опорного:{' '}
                {Math.round(
                  (comparison.baseline.activeDemandValue /
                    Math.max(comparison.totals.activeDemandValue, 1)) *
                    1000
                ) / 10}
                %
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
};
