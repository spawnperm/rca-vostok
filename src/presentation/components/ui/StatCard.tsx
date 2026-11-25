import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'accent' | 'positive' | 'danger';
  icon?: React.ReactNode;
}

const VALUE_TONES: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-slate-900',
  accent: 'text-[#0077FF]',
  positive: 'text-emerald-700',
  danger: 'text-red-600',
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  tone = 'default',
  icon,
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
      <span>{label}</span>
      {icon && <span className="text-slate-400">{icon}</span>}
    </div>
    <div className={`mt-1.5 text-2xl font-bold tracking-tight tabular-nums ${VALUE_TONES[tone]}`}>
      {value}
    </div>
    {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
  </div>
);
