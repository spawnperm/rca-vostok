import React, { useMemo, useState } from 'react';
import { BarChart3, Check, LineChart as LineChartIcon, Radar as RadarIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DEFAULT_SELECTED_DFO_REGION_IDS,
  DFO_CONCENTRATION_PRESETS,
  buildMultiRegionConcentrationTimeSeries,
  buildMultiRegionCurrentBars,
  buildMultiRegionRadarProfile,
  getDfoRegionsConcentrationMeta,
  toggleDfoRegionId,
  type MultiRegionConcentrationBarPoint,
  type MultiRegionRadarDatum,
} from '../utils/dfoMultiRegionConcentration';
import { tracker } from '../utils/tracker';

type ChartViewMode = 'bars' | 'timeline' | 'radar';

interface BarTooltipPayloadEntry {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: MultiRegionConcentrationBarPoint;
}

interface LineTooltipPayloadEntry {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: { year?: string; phase?: 'факт' | 'прогноз' };
}

const MultiRegionBarTooltip: React.FC<{
  active?: boolean;
  payload?: BarTooltipPayloadEntry[];
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg p-3.5 shadow-xl max-w-xs text-xs space-y-2">
      <div className="flex items-baseline justify-between gap-3 border-b border-slate-700 pb-1.5">
        <span className="font-bold text-teal-300">{pt.name}</span>
        <span className="font-mono text-[11px] text-slate-300 tabular-nums shrink-0">
          {Math.round(pt.areaKm2 / 1000).toLocaleString('ru-RU')} тыс. км²
        </span>
      </div>

      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-300">Плотность реестра:</span>
          <span className="font-mono font-bold text-teal-300 tabular-nums">
            {pt.certifiedDensity.toFixed(2).replace('.', ',')} / 10 тыс. км²
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-300">Плотность спроса:</span>
          <span className="font-mono font-bold text-amber-300 tabular-nums">
            {pt.demandDensity.toFixed(2).replace('.', ',')} / 10 тыс. км²
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800">
          <span className="text-slate-300">Реестр / расчётный спрос:</span>
          <span className="font-mono font-semibold text-white tabular-nums">
            {pt.certifiedInRegistry} / {pt.estimatedDemand} чел. ({pt.coveragePct}%)
          </span>
        </div>
      </div>
    </div>
  );
};

const MultiRegionLineTooltip: React.FC<{
  active?: boolean;
  payload?: LineTooltipPayloadEntry[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const phase = payload[0]?.payload?.phase;
  const sorted = [...payload].sort(
    (a, b) => Number(b.value ?? 0) - Number(a.value ?? 0)
  );

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg p-3.5 shadow-xl max-w-xs text-xs space-y-2">
      <div className="flex items-baseline justify-between gap-4 border-b border-slate-700 pb-1.5">
        <span className="font-mono font-bold text-teal-300 tabular-nums">{label} г.</span>
        <span className="text-[11px] text-slate-300">
          {phase === 'факт' ? 'Факт ЕФРТА' : 'Прогноз РЦА'} · инстр./10 тыс. км²
        </span>
      </div>

      <div className="space-y-1.5 text-[11px]">
        {sorted.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-slate-200 truncate">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: entry.color }}
                aria-hidden="true"
              />
              <span className="truncate">{entry.name}</span>
            </span>
            <span className="font-mono font-bold text-white tabular-nums shrink-0">
              {typeof entry.value === 'number'
                ? entry.value.toFixed(2).replace('.', ',')
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface RadarTooltipPayloadEntry {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: MultiRegionRadarDatum;
}

const formatRadarRawValue = (raw: number | undefined, unit: string): string => {
  if (typeof raw !== 'number' || Number.isNaN(raw)) return '—';
  if (unit === 'чел.') return `${Math.round(raw).toLocaleString('ru-RU')} чел.`;
  if (unit === '%') return `${raw.toFixed(1).replace('.', ',')}%`;
  if (unit === '×') return `${raw.toFixed(2).replace('.', ',')}×`;
  return `${raw.toFixed(2).replace('.', ',')} ${unit}`;
};

const MultiRegionRadarTooltip: React.FC<{
  active?: boolean;
  payload?: RadarTooltipPayloadEntry[];
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  const sorted = [...payload].sort(
    (a, b) => Number(b.value ?? 0) - Number(a.value ?? 0)
  );

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg p-3.5 shadow-xl max-w-xs text-xs space-y-2">
      <div className="border-b border-slate-700 pb-1.5 space-y-0.5">
        <div className="font-bold text-teal-300">{datum.metric}</div>
        <p className="text-[11px] text-slate-300 leading-snug">{datum.fullLabel}</p>
      </div>

      <div className="space-y-1.5 text-[11px]">
        {sorted.map((entry) => {
          const regionId = String(entry.dataKey ?? '');
          const rawVal = datum.rawValues?.[regionId];
          return (
            <div key={regionId} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-slate-200 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden="true"
                />
                <span className="truncate">{entry.name}</span>
              </span>
              <span className="font-mono font-bold text-white tabular-nums shrink-0">
                {formatRadarRawValue(rawVal, datum.unit)}{' '}
                <span className="text-slate-400 font-normal">
                  ({typeof entry.value === 'number' ? Math.round(entry.value) : entry.value}/100)
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DfoMultiRegionConcentrationChart: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    ...DEFAULT_SELECTED_DFO_REGION_IDS,
  ]);
  const [chartMode, setChartMode] = useState<ChartViewMode>('bars');

  const allMetas = useMemo(() => getDfoRegionsConcentrationMeta(), []);

  const barData = useMemo(
    () => buildMultiRegionCurrentBars(selectedIds),
    [selectedIds]
  );

  const timeSeriesData = useMemo(
    () => buildMultiRegionConcentrationTimeSeries(selectedIds),
    [selectedIds]
  );

  const radarData = useMemo(
    () => buildMultiRegionRadarProfile(selectedIds),
    [selectedIds]
  );

  const selectedMetas = useMemo(
    () => allMetas.filter((m) => selectedIds.includes(m.id)),
    [allMetas, selectedIds]
  );

  const dfoAverageDensity = useMemo(() => {
    const totalCert = allMetas.reduce((s, m) => s + m.certifiedInRegistry, 0);
    const totalArea = allMetas.reduce((s, m) => s + m.areaKm2, 0);
    return Math.round((totalCert / Math.max(totalArea / 10000, 1)) * 100) / 100;
  }, [allMetas]);

  const leaderMeta = useMemo(() => {
    if (selectedMetas.length === 0) return allMetas[0];
    return selectedMetas.reduce((best, cur) =>
      cur.currentDensityPer10kKm2 > best.currentDensityPer10kKm2 ? cur : best
    );
  }, [selectedMetas, allMetas]);

  const handleToggleRegion = (id: string) => {
    setSelectedIds((prev) => {
      const next = toggleDfoRegionId(prev, id, 1);
      const matched = allMetas.find((m) => m.id === id);
      tracker.trackCustomInteraction(
        'Мульти-сравнение концентрации ДФО',
        `${matched?.shortName ?? id} (${next.length} выбр.)`
      );
      return next;
    });
  };

  const handleApplyPreset = (presetId: string, regionIds: readonly string[], label: string) => {
    setSelectedIds([...regionIds]);
    tracker.trackCustomInteraction('Мульти-сравнение концентрации: пресет', `${presetId}:${label}`);
  };

  return (
    <section
      aria-labelledby="dfo-multi-concentration-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Chart Mode Tabs */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-medium text-teal-700">
            Одновременное сопоставление произвольного набора субъектов
          </p>
          <h2 id="dfo-multi-concentration-heading" className="text-xl font-bold text-slate-900">
            Сравнение концентрации инструкторов выбранных регионов ДФО на одном графике
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Отметьте два и более региона Дальнего Востока, чтобы одновременно сравнить их
            текущую плотность в реестре, плотность расчётного спроса и динамику до 2030 года
            (чел. на 10 тыс. км²).
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Режим графика концентрации регионов ДФО"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={chartMode === 'bars'}
            onClick={() => {
              setChartMode('bars');
              tracker.trackCustomInteraction('Мульти-график концентрации: столбцы');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              chartMode === 'bars'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Текущая плотность vs спрос</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={chartMode === 'timeline'}
            onClick={() => {
              setChartMode('timeline');
              tracker.trackCustomInteraction('Мульти-график концентрации: линейный график');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              chartMode === 'timeline'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LineChartIcon className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Линейный (2024–2030)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={chartMode === 'radar'}
            onClick={() => {
              setChartMode('radar');
              tracker.trackCustomInteraction('Мульти-график концентрации: радарная диаграмма');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              chartMode === 'radar'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RadarIcon className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Радарная диаграмма</span>
          </button>
        </div>
      </div>

      {/* Multi-Select DFO Regions Checklist & Presets */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-700">
            Выберите регионы ДФО ({selectedIds.length} из {allMetas.length} на графике):
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {DFO_CONCENTRATION_PRESETS.map((preset) => {
              const isMatch =
                selectedIds.length === preset.regionIds.length &&
                preset.regionIds.every((id) => selectedIds.includes(id));
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    handleApplyPreset(preset.id, preset.regionIds, preset.label)
                  }
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isMatch
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          role="group"
          aria-label="Чекбоксы выбора регионов ДФО для графика концентрации"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5"
        >
          {allMetas.map((meta) => {
            const checked = selectedIds.includes(meta.id);
            const isLastRemaining = checked && selectedIds.length <= 1;

            return (
              <button
                key={meta.id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={isLastRemaining}
                onClick={() => handleToggleRegion(meta.id)}
                title={
                  isLastRemaining
                    ? 'На графике должен оставаться хотя бы 1 регион'
                    : `Переключить ${meta.name}`
                }
                className={`px-3 py-2.5 rounded-lg border text-left transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                  checked
                    ? 'bg-white border-teal-600 shadow-xs text-slate-900'
                    : 'bg-slate-100/70 border-slate-200 text-slate-500 hover:bg-white hover:text-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                      checked ? 'border-transparent text-white' : 'border-slate-300 bg-white'
                    }`}
                    style={checked ? { backgroundColor: meta.color } : undefined}
                    aria-hidden="true"
                  >
                    {checked && <Check className="w-3 h-3" strokeWidth={2.5} />}
                  </span>
                  <span className="text-xs font-semibold truncate">{meta.shortName}</span>
                </span>
                <span className="font-mono text-[11px] tabular-nums text-slate-600 shrink-0">
                  {meta.currentDensityPer10kKm2.toFixed(2).replace('.', ',')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary KPI Bar for Selected Regions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] text-slate-500">Выбрано субъектов на графике</p>
          <p className="mt-1 text-lg font-bold font-mono text-slate-900 tabular-nums">
            {selectedIds.length} из {allMetas.length} регионов ДФО
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] text-slate-500">Макс. концентрация среди выбранных</p>
          <p className="mt-1 text-lg font-bold font-mono text-teal-800 tabular-nums">
            {leaderMeta.shortName}:{' '}
            {leaderMeta.currentDensityPer10kKm2.toFixed(2).replace('.', ',')} / 10 тыс. км²
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-[11px] text-slate-500">Среднее по всему ДФО (ориентир)</p>
          <p className="mt-1 text-lg font-bold font-mono text-slate-900 tabular-nums">
            {dfoAverageDensity.toFixed(2).replace('.', ',')} чел. / 10 тыс. км²
          </p>
        </div>
      </div>

      {/* Unified Recharts Visualization Canvas */}
      <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white space-y-3">
        <div className={chartMode === 'radar' ? 'w-full h-[380px]' : 'w-full h-[340px]'}>
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'bars' ? (
              <BarChart
                data={barData}
                margin={{ top: 14, right: 20, left: -6, bottom: 12 }}
                barGap={6}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="shortName"
                  tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{
                    fontSize: 11,
                    fill: '#64748B',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(15, 118, 110, 0.08)' }}
                  content={<MultiRegionBarTooltip />}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <ReferenceLine
                  y={dfoAverageDensity}
                  stroke="#475569"
                  strokeDasharray="4 4"
                  label={{
                    value: `Среднее ДФО (${dfoAverageDensity.toFixed(2).replace('.', ',')})`,
                    position: 'insideTopRight',
                    fill: '#475569',
                    fontSize: 11,
                  }}
                />
                <Bar
                  dataKey="certifiedDensity"
                  name="Текущая концентрация в реестре (на 10 тыс. км²)"
                  fill="#0F766E"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="demandDensity"
                  name="Требуемая плотность по спросу (на 10 тыс. км²)"
                  fill="#D97706"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            ) : chartMode === 'timeline' ? (
              <LineChart
                data={timeSeriesData}
                margin={{ top: 14, right: 20, left: -6, bottom: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="year"
                  tick={{
                    fontSize: 11,
                    fill: '#475569',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fontSize: 11,
                    fill: '#64748B',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <Tooltip
                  trigger="hover"
                  shared
                  cursor={{ stroke: '#0F766E', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                  allowEscapeViewBox={{ x: true, y: true }}
                  content={<MultiRegionLineTooltip />}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                  iconType="plainline"
                />
                <ReferenceLine
                  x="2026"
                  stroke="#94A3B8"
                  strokeDasharray="4 4"
                  label={{
                    value: 'ПП № 1893 (2026)',
                    position: 'top',
                    fill: '#475569',
                    fontSize: 10.5,
                  }}
                />
                {selectedMetas.map((meta) => (
                  <Line
                    key={meta.id}
                    type="monotone"
                    dataKey={meta.id}
                    name={meta.shortName}
                    stroke={meta.color}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#FFFFFF', stroke: meta.color, strokeWidth: 2 }}
                    activeDot={{ r: 6.5, fill: meta.color, stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                ))}
              </LineChart>
            ) : (
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                <PolarGrid stroke="#CBD5E1" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tickCount={5}
                  tick={{
                    fontSize: 10,
                    fill: '#64748B',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                />
                <Tooltip
                  allowEscapeViewBox={{ x: true, y: true }}
                  content={<MultiRegionRadarTooltip />}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                {selectedMetas.map((meta) => (
                  <Radar
                    key={meta.id}
                    name={meta.shortName}
                    dataKey={meta.id}
                    stroke={meta.color}
                    fill={meta.color}
                    fillOpacity={selectedMetas.length > 3 ? 0.12 : 0.18}
                    strokeWidth={2.25}
                    dot={{ r: 3.5, fill: '#FFFFFF', stroke: meta.color, strokeWidth: 1.75 }}
                    activeDot={{ r: 5.5, fill: meta.color, stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                ))}
              </RadarChart>
            )}
          </ResponsiveContainer>
        </div>

        {chartMode === 'radar' && (
          <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-2.5">
            Шкала осей (0–100) нормирована относительно максимума среди всех 7 регионов ДФО по каждому из 6 измерений. Наведите на вершину многоугольника для просмотра точных значений в исходных единицах.
          </p>
        )}
      </div>
    </section>
  );
};
