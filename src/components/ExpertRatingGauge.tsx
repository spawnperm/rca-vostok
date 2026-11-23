import React from 'react';
import { Award, TrendingUp } from 'lucide-react';
import {
  QUALIFICATION_LEVELS,
  type ExpertRatingResult,
} from '../utils/expertRatingCalculator';

interface ExpertRatingGaugeProps {
  rating: ExpertRatingResult;
}

export const ExpertRatingGauge: React.FC<ExpertRatingGaugeProps> = ({ rating }) => {
  // Semi-circular Gauge Chart geometry (180-degree arc from left to right)
  const size = 280;
  const cx = 140;
  const cy = 142;
  const radius = 104;
  const strokeWidth = 18;
  const circumference = Math.PI * radius; // semi-circle arc length
  const clampedPct = Math.max(0, Math.min(100, rating.levelProgressPercent));
  const dashOffset = circumference * (1 - clampedPct / 100);

  // Needle / marker position along the 180-degree arc (pi -> 0 radians)
  const angleRad = Math.PI * (1 - clampedPct / 100);
  const markerX = cx + radius * Math.cos(angleRad);
  const markerY = cy - radius * Math.sin(angleRad);

  const isMaxLevel = rating.nextLevel === null;

  const arcColor = isMaxLevel
    ? '#0F766E'
    : clampedPct >= 75
    ? '#0F766E'
    : clampedPct >= 40
    ? '#0284C7'
    : '#D97706';

  const breakdownRows = [
    {
      label: 'Полевой опыт (стаж и группы)',
      value: rating.experiencePoints,
      max: rating.maxExperiencePoints,
      color: 'bg-slate-900',
    },
    {
      label: 'Пройденные курсы (ДПО, WFA, ФСТР)',
      value: rating.coursesPoints,
      max: rating.maxCoursesPoints,
      color: 'bg-teal-700',
    },
    {
      label: 'Категории сложности походов (1–4 КС)',
      value: rating.complexityPoints,
      max: rating.maxComplexityPoints,
      color: 'bg-sky-700',
    },
  ];

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-teal-700">
            Визуализация квалификационной траектории
          </p>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
            Путь до следующего квалификационного уровня
          </h3>
        </div>
        <div className="text-right font-mono tabular-nums">
          <p className="text-[11px] text-slate-500">Общий балл</p>
          <p className="text-xl font-bold text-slate-900">
            {rating.totalScore}{' '}
            <span className="text-xs font-normal text-slate-500">/ 100</span>
          </p>
        </div>
      </div>

      {/* Semi-circular SVG Gauge Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col items-center">
        <div className="w-full max-w-[300px]">
          <svg
            viewBox={`0 0 ${size} 168`}
            className="w-full h-auto overflow-visible"
            role="img"
            aria-label={`Шкала прогресса до следующего уровня: ${clampedPct}% пройдено, общий рейтинг ${rating.totalScore} из 100 баллов`}
          >
            {/* Tick marks at 0%, 25%, 50%, 75%, 100% */}
            {[0, 25, 50, 75, 100].map((tick) => {
              const rad = Math.PI * (1 - tick / 100);
              const innerR = radius - strokeWidth / 2 - 6;
              const outerR = radius - strokeWidth / 2 - 12;
              const labelR = radius + strokeWidth / 2 + 12;
              const x1 = cx + innerR * Math.cos(rad);
              const y1 = cy - innerR * Math.sin(rad);
              const x2 = cx + outerR * Math.cos(rad);
              const y2 = cy - outerR * Math.sin(rad);
              const lx = cx + labelR * Math.cos(rad);
              const ly = cy - labelR * Math.sin(rad);

              return (
                <g key={tick}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#CBD5E1"
                    strokeWidth={1.5}
                  />
                  <text
                    x={lx}
                    y={ly + 3}
                    textAnchor="middle"
                    className="fill-slate-400 text-[9px] font-mono"
                  >
                    {tick}%
                  </text>
                </g>
              );
            })}

            {/* Background semi-circle track */}
            <path
              d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
              fill="none"
              stroke="#E2E8F0"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />

            {/* Active progress arc */}
            <path
              d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
              fill="none"
              stroke={arcColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 280ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            />

            {/* Current position marker dot */}
            <circle
              cx={markerX}
              cy={markerY}
              r={6}
              fill="#0F172A"
              stroke="#FFFFFF"
              strokeWidth={2.5}
            />

            {/* Center KPI Readout */}
            <text
              x={cx}
              y={cy - 28}
              textAnchor="middle"
              className="fill-slate-900 text-[30px] font-bold font-mono"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {clampedPct}%
            </text>
            <text
              x={cx}
              y={cy - 8}
              textAnchor="middle"
              className="fill-slate-500 text-[11px] font-medium"
            >
              {isMaxLevel ? 'Максимальный уровень достигнут' : 'пути до следующего уровня'}
            </text>
          </svg>
        </div>

        {/* Current & Target Level Readout */}
        <div className="w-full pt-4 mt-2 border-t border-slate-200 space-y-2.5 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="inline-flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-teal-800">
              <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {rating.currentLevel.code} · {rating.currentLevel.title}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-600 tabular-nums">
              {rating.nextLevel
                ? `До «${rating.nextLevel.shortTitle}»: +${rating.pointsToNextLevel} б.`
                : 'Высшая ступень (90–100 б.)'}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {rating.currentLevel.summary}
          </p>
        </div>
      </div>

      {/* Linear Qualification Tier Ladder (1 -> 5) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium text-slate-700 inline-flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            <span>Шкала уровней РЦА (0–100 баллов)</span>
          </span>
          <span className="font-mono tabular-nums">
            Макс. КС: {rating.highestComplexityLabel}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {QUALIFICATION_LEVELS.map((lvl) => {
            const isCurrent = lvl.level === rating.currentLevel.level;
            const isPassed = lvl.level < rating.currentLevel.level;
            return (
              <div
                key={lvl.level}
                className={`rounded-lg border p-2 text-center transition-colors ${
                  isCurrent
                    ? 'bg-teal-700 border-teal-700 text-white'
                    : isPassed
                    ? 'bg-teal-50 border-teal-200 text-teal-900'
                    : 'bg-white border-slate-200 text-slate-500'
                }`}
              >
                <p className="text-[11px] font-mono font-semibold tabular-nums">
                  {lvl.minScore}–{lvl.maxScore}
                </p>
                <p className="text-[10px] leading-tight mt-0.5 truncate" title={lvl.title}>
                  {lvl.shortTitle}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Component Score Breakdown */}
      <div className="space-y-3 pt-2 border-t border-slate-200">
        {breakdownRows.map((row) => {
          const pct = Math.round((row.value / row.max) * 100);
          return (
            <div key={row.label} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-slate-700 font-medium">{row.label}</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                  {row.value} / {row.max} б.
                </span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${row.color} rounded-full transition-all duration-200`}
                  style={{ width: `${Math.max(pct, row.value > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
