import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  CheckSquare,
  CornerDownLeft,
  Database,
  FileCode2,
  FileText,
  Layers,
  Search,
  Users,
} from 'lucide-react';
import { refineClient } from '../../application/refine/client.ts';
import {
  type GlobalSearchEntityType,
  type GlobalSearchResultItem,
} from '../../application/search/globalSearch.ts';
import type { MenuItemDef } from '../navigation/portalMenu.tsx';
import type { PortalSectionId } from '../types.ts';
import { Modal } from './ui/Modal.tsx';

export type PortalNavItem = MenuItemDef & { groupTitle: string };

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
  navItems: PortalNavItem[];
  activeSection: PortalSectionId;
  onNavigateSection: (sectionId: PortalSectionId) => void;
}

const TYPE_TABS: Array<{ id: GlobalSearchEntityType; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'deal', label: 'Сделки' },
  { id: 'contact', label: 'Контакты' },
  { id: 'company', label: 'Компании' },
  { id: 'task', label: 'Задачи' },
  { id: 'document', label: 'Документы' },
  { id: 'adr', label: 'ADR' },
];

function renderEntityIcon(type: GlobalSearchResultItem['type']) {
  switch (type) {
    case 'deal':
      return <Briefcase className="h-4 w-4 text-[#0077FF]" />;
    case 'contact':
      return <Users className="h-4 w-4 text-emerald-600" />;
    case 'company':
      return <Building2 className="h-4 w-4 text-indigo-600" />;
    case 'task':
      return <CheckSquare className="h-4 w-4 text-amber-600" />;
    case 'document':
      return <FileText className="h-4 w-4 text-sky-600" />;
    case 'cms':
      return <Database className="h-4 w-4 text-teal-600" />;
    case 'adr':
      return <FileCode2 className="h-4 w-4 text-slate-700" />;
  }
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  open,
  onClose,
  navItems,
  activeSection,
  onNavigateSection,
}) => {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<GlobalSearchEntityType>('all');
  const [results, setResults] = useState<GlobalSearchResultItem[]>([]);
  const [totalIndexed, setTotalIndexed] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setFilterType('all');
      setSelectedIndex(0);
    }
  }, [open]);

  const matchingNavItems = useMemo(() => {
    if (filterType !== 'all') return [];
    const q = query.trim().toLowerCase();
    if (!q) return navItems.slice(0, 5);
    return navItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    );
  }, [filterType, navItems, query]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        if (filterType !== 'all') params.set('type', filterType);
        const data = await refineClient.request<{
          totalIndexed: number;
          results: GlobalSearchResultItem[];
        }>(`/api/search?${params.toString()}`);
        if (!cancelled) {
          setResults(data.results || []);
          setTotalIndexed(data.totalIndexed || 0);
          setSelectedIndex(0);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query, filterType]);

  const combinedCount = results.length + matchingNavItems.length;

  const handleSelectAtIndex = (index: number) => {
    if (index < results.length) {
      onNavigateSection(results[index].targetSection);
      onClose();
      return;
    }
    const navIdx = index - results.length;
    if (navIdx >= 0 && navIdx < matchingNavItems.length) {
      onNavigateSection(matchingNavItems[navIdx].id);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Глобальный поиск по порталу"
      subtitle={`Индекс PostgreSQL и документов · Записей доступно по RBAC: ${totalIndexed}`}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) =>
                  combinedCount > 0 ? (prev + 1) % combinedCount : 0
                );
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) =>
                  combinedCount > 0 ? (prev - 1 + combinedCount) % combinedCount : 0
                );
              } else if (e.key === 'Enter' && combinedCount > 0) {
                e.preventDefault();
                handleSelectAtIndex(selectedIndex);
              }
            }}
            placeholder="Поиск по сделкам, клиентам, задачам, Univer-документам, ADR или разделам..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-[#0077FF] focus:bg-white"
          />
        </div>

        {/* Interactive entity filter tabs */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {TYPE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterType(t.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                filterType === t.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
          {loading && results.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Выполняется поиск по базе данных...
            </div>
          ) : combinedCount === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              По запросу «{query}» ничего не найдено в текущем тенанте и правах RBAC
            </div>
          ) : (
            <>
              {results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => handleSelectAtIndex(idx)}
                    className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'border-[#0077FF] bg-blue-50/40'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">{renderEntityIcon(item.type)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-slate-900">
                          {item.title}
                        </span>
                        <span className="shrink-0 text-[11px] font-medium text-slate-500 tabular-nums">
                          {item.badge} · score {item.relevanceScore}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-600">
                        {item.subtitle}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {item.highlightSnippet || item.snippet}
                      </p>
                    </div>
                  </button>
                );
              })}

              {matchingNavItems.length > 0 && (
                <div className="pt-2">
                  <div className="mb-1 px-1 text-[11px] font-medium text-slate-500">
                    Разделы портала
                  </div>
                  <div className="space-y-1">
                    {matchingNavItems.map((nav, navIdx) => {
                      const combinedIdx = results.length + navIdx;
                      const isSelected = combinedIdx === selectedIndex;
                      const isCurrent = activeSection === nav.id;
                      return (
                        <button
                          key={nav.id}
                          type="button"
                          onMouseEnter={() => setSelectedIndex(combinedIdx)}
                          onClick={() => handleSelectAtIndex(combinedIdx)}
                          className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                            isSelected || isCurrent
                              ? 'border-[#0077FF] bg-blue-50/40'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <span className="mt-0.5 shrink-0 text-[#0077FF]">
                            <Layers className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900">
                                {nav.label}
                              </span>
                              <span className="text-[11px] text-slate-400">{nav.groupTitle}</span>
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500">
                              {nav.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
          <span>Стрелки ↑↓ для навигации · Esc для закрытия</span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> Enter — открыть раздел
          </span>
        </div>
      </div>
    </Modal>
  );
};
