import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
    {icon && (
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </div>
    )}
    <div className="text-sm font-semibold text-slate-900">{title}</div>
    {description && <p className="mt-1 max-w-md text-xs text-slate-500">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
