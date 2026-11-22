import React, { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { tracker } from '../utils/tracker';
import { formatRub } from '../utils/format.ts';

type TrainingTrackId = 'hiking' | 'water' | 'expedition';

interface CategoryCostRow {
  category: string;
  shortNote: string;
  dpoTuition: number;
  fieldPolygonAndWfa: number;
  passportAndMedical: number;
  advancedSafetyModule: number;
  total: number;
}

interface TrackCostProfile {
  id: TrainingTrackId;
  label: string;
  subtitle: string;
  rows: Omit<CategoryCostRow, 'total'>[];
}

const TRACK_COST_PROFILES: TrackCostProfile[] = [
  {
    id: 'hiking',
    label: 'Пешеходный и горный туризм',
    subtitle: 'Переподготовка ВВГУ (≈ 250 ч) + полевые сборы Шкотовского полигона',
    rows: [
      {
        category: '1 к.с.',
        shortNote: 'Базовые маршруты и экотропы',
        dpoTuition: 27200,
        fieldPolygonAndWfa: 9000,
        passportAndMedical: 5300,
        advancedSafetyModule: 0,
      },
      {
        category: '2 к.с.',
        shortNote: 'Горные хребты и переправы',
        dpoTuition: 27200,
        fieldPolygonAndWfa: 12000,
        passportAndMedical: 6800,
        advancedSafetyModule: 3500,
      },
      {
        category: '3 к.с.',
        shortNote: 'Сложные автономные треки',
        dpoTuition: 32000,
        fieldPolygonAndWfa: 14500,
        passportAndMedical: 7500,
        advancedSafetyModule: 8000,
      },
    ],
  },
  {
    id: 'water',
    label: 'Водный туризм и сплавы',
    subtitle: 'Модульный поток ВВГУ (27 200 ₽) + спасработы на течении и морской каякинг',
    rows: [
      {
        category: '1 к.с.',
        shortNote: 'Спокойная вода и базовые пороги',
        dpoTuition: 27200,
        fieldPolygonAndWfa: 10500,
        passportAndMedical: 5800,
        advancedSafetyModule: 0,
      },
      {
        category: '2 к.с.',
        shortNote: 'Порожистые реки ДФО и каякинг',
        dpoTuition: 27200,
        fieldPolygonAndWfa: 13500,
        passportAndMedical: 6800,
        advancedSafetyModule: 4500,
      },
      {
        category: '3 к.с.',
        shortNote: 'Горные сплавы повышенного риска',
        dpoTuition: 32000,
        fieldPolygonAndWfa: 16500,
        passportAndMedical: 7800,
        advancedSafetyModule: 9500,
      },
    ],
  },
  {
    id: 'expedition',
    label: 'Автотуризм и экспедиционный профиль',
    subtitle: 'Специализированная программа ВВГУ + протоколы автономной эвакуации ДФО',
    rows: [
      {
        category: '1 к.с.',
        shortNote: 'Маршруты ООПТ и прибрежные трассы',
        dpoTuition: 29500,
        fieldPolygonAndWfa: 9500,
        passportAndMedical: 5800,
        advancedSafetyModule: 0,
      },
      {
        category: '2 к.с.',
        shortNote: 'Бездорожье и таёжные кластеры',
        dpoTuition: 29500,
        fieldPolygonAndWfa: 12500,
        passportAndMedical: 7200,
        advancedSafetyModule: 4000,
      },
      {
        category: '3 к.с.',
        shortNote: 'Удалённые экспедиции Севера ДФО',
        dpoTuition: 34500,
        fieldPolygonAndWfa: 16000,
        passportAndMedical: 8200,
        advancedSafetyModule: 9000,
      },
    ],
  },
];

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  payload?: CategoryCostRow;
}

const ComplexityCostTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;

  return (
    <div className="bg-slate-900 text-white border border-slate-700 rounded-lg p-3.5 shadow-lg max-w-xs text-xs space-y-2">
      <div className="border-b border-slate-700 pb-1.5">
        <p className="font-mono font-bold text-teal-300">{label}</p>
        {row && <p className="text-[11px] text-slate-300 mt-0.5">{row.shortNote}</p>}
      </div>
      <div className="space-y-1.5">
        {payload.map((entry) => {
          const val = Number(entry.value ?? 0);
          if (val === 0) return null;
          return (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-slate-200 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden="true"
                />
                <span className="truncate">{entry.name}</span>
              </span>
              <span className="font-mono font-semibold tabular-nums text-white shrink-0">
                {formatRub(val)}
              </span>
            </div>
          );
        })}
      </div>
      {row && (
        <div className="pt-1.5 border-t border-slate-700 flex items-center justify-between font-mono font-bold text-teal-300 tabular-nums">
          <span>Итого обучение:</span>
          <span>{formatRub(row.total)}</span>
        </div>
      )}
    </div>
  );
};

export const TrainingCostByComplexityChart: React.FC = () => {
  const [trackId, setTrackId] = useState<TrainingTrackId>('water');
  const [applySubsidy, setApplySubsidy] = useState<boolean>(false);

  const activeTrack =
    TRACK_COST_PROFILES.find((t) => t.id === trackId) ?? TRACK_COST_PROFILES[0];

  const chartData: CategoryCostRow[] = useMemo(
    () =>
      activeTrack.rows.map((row) => {
        const dpoTuition = applySubsidy
          ? Math.round(row.dpoTuition * 0.3)
          : row.dpoTuition;
        const total =
          dpoTuition +
          row.fieldPolygonAndWfa +
          row.passportAndMedical +
          row.advancedSafetyModule;
        return {
          ...row,
          dpoTuition,
          total,
        };
      }),
    [activeTrack, applySubsidy]
  );

  // Cost difference between the hardest and easiest category.
  //
  // The indexes used to be hard-coded (chartData[2] - chartData[0]), which reads
  // as a magic offset and throws "Cannot read properties of undefined" the
  // moment a track ships with fewer than three rows. Reading the endpoints of
  // the array says what is meant and cannot crash on a shorter track.
  const delta1to3 =
    chartData.length > 1
      ? chartData[chartData.length - 1].total - chartData[0].total
      : 0;

  return (
    <section
      aria-labelledby="complexity-cost-chart-heading"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <p className="text-xs font-medium text-teal-700 inline-flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Визуализация структуры затрат · Recharts</span>
          </p>
          <h2
            id="complexity-cost-chart-heading"
            className="text-xl sm:text-2xl font-bold text-slate-900"
          >
            Распределение стоимости обучения по категориям сложности (1–3 к.с.)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Сравнение структуры расходов на обучение и подготовку инструктора-проводника по
            маршрутам 1, 2 и 3 категории сложности: базовый курс ДПО ВВГУ, полевые сборы и WFA,
            подготовка паспорта маршрута и спецмодуль ПСР для 2–3 к.с.
          </p>
        </div>

        <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={applySubsidy}
            onChange={(e) => {
              setApplySubsidy(e.target.checked);
              tracker.trackCustomInteraction(
                'Диаграмма стоимости 1–3 к.с.: субсидия Приморья',
                e.target.checked ? 'вкл' : 'выкл'
              );
            }}
            className="w-4 h-4 accent-teal-700 rounded cursor-pointer"
          />
          <span>Субсидия Приморья (−70% ДПО)</span>
        </label>
      </div>

      {/* Track Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
        <div
          role="tablist"
          aria-label="Направление подготовки"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {TRACK_COST_PROFILES.map((track) => {
            const active = track.id === trackId;
            return (
              <button
                key={track.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTrackId(track.id);
                  tracker.trackCustomInteraction(
                    `Диаграмма стоимости 1–3 к.с.: ${track.label}`
                  );
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {track.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-slate-500">{activeTrack.subtitle}</p>
      </div>

      {/* Chart + KPI Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-slate-50/70 border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="category"
                  tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => `${Math.round(v / 1000)} тыс.`}
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={62}
                />
                <Tooltip content={<ComplexityCostTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  iconType="square"
                />
                <Bar
                  dataKey="dpoTuition"
                  name="Базовое ДПО ВВГУ"
                  stackId="cost"
                  fill="#0F766E"
                  radius={[0, 0, 0, 0]}
                  barSize={64}
                />
                <Bar
                  dataKey="fieldPolygonAndWfa"
                  name="Полигон и практикум WFA"
                  stackId="cost"
                  fill="#0284C7"
                  barSize={64}
                />
                <Bar
                  dataKey="passportAndMedical"
                  name="Паспорт маршрута и медосмотр"
                  stackId="cost"
                  fill="#D97706"
                  barSize={64}
                />
                <Bar
                  dataKey="advancedSafetyModule"
                  name="Спецмодуль ПСР (2–3 к.с.)"
                  stackId="cost"
                  fill="#334155"
                  radius={[4, 4, 0, 0]}
                  barSize={64}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category cards on right */}
        <div className="lg:col-span-4 space-y-3">
          {chartData.map((row) => (
            <div
              key={row.category}
              className="border border-slate-200 rounded-xl p-4 bg-white space-y-1.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-slate-900">{row.category}</span>
                <span className="font-mono text-base font-bold text-teal-800 tabular-nums">
                  {formatRub(row.total)}
                </span>
              </div>
              <p className="text-xs text-slate-500">{row.shortNote}</p>
              <p className="text-[11px] font-mono text-slate-600 tabular-nums pt-1 border-t border-slate-100">
                ДПО: {formatRub(row.dpoTuition)} · Практика и допуск:{' '}
                {formatRub(row.total - row.dpoTuition)}
              </p>
            </div>
          ))}

          <div className="bg-slate-900 text-white rounded-xl p-4 space-y-1 text-xs">
            <p className="text-slate-300">Разница между 1 к.с. и 3 к.с.</p>
            <p className="text-lg font-mono font-bold text-teal-300 tabular-nums">
              + {formatRub(delta1to3)}
            </p>
            <p className="text-[11px] text-slate-400 leading-snug">
              Удорожание на 3 к.с. связано с углублённым полигоном, оценкой ПСР и автономной
              эвакуацией группы.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
