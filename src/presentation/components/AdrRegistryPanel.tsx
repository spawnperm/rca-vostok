import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookMarked, Download, Plus, RefreshCw, Search } from 'lucide-react';
import { refineClient } from '../../application/refine/client.ts';
import type { AdrRecord } from '../../infrastructure/telemetry/adrService.ts';
import { getErrorMessage } from '../../shared/formatters.ts';
import { Modal } from './ui/Modal.tsx';

interface AdrRegistryPanelProps {
  canCreate: boolean;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

export const AdrRegistryPanel: React.FC<AdrRegistryPanelProps> = ({ canCreate, onNotify }) => {
  const [adrs, setAdrs] = useState<AdrRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [status, setStatus] = useState<AdrRecord['status']>('Accepted');
  const [deciders, setDeciders] = useState('Архитектурный комитет NexusHarness');
  const [context, setContext] = useState('');
  const [decision, setDecision] = useState('');
  const [consequences, setConsequences] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAdrs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await refineClient.request<{ adrs: AdrRecord[] }>('/api/adrs');
      setAdrs(res.adrs || []);
      if (res.adrs?.length) {
        setSelectedId((prev) =>
          prev && res.adrs.some((a) => a.id === prev) ? prev : res.adrs[0].id
        );
      }
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка загрузки реестра ADR'), 'err');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void loadAdrs();
  }, [loadAdrs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return adrs;
    return adrs.filter(
      (a) =>
        a.number.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.decision.toLowerCase().includes(q)
    );
  }, [adrs, query]);

  const activeAdr = useMemo(
    () => filtered.find((a) => a.id === selectedId) || filtered[0] || null,
    [filtered, selectedId]
  );

  const openNewAdrModal = () => {
    const nextNum = String(adrs.length + 1).padStart(4, '0');
    setNumber(nextNum);
    setTitle('');
    setVersion('1.0.0');
    setStatus('Accepted');
    setContext('');
    setDecision('');
    setConsequences('');
    setCreateOpen(true);
  };

  const handleCreateAdr = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await refineClient.request<{ adr: AdrRecord }>('/api/adrs', {
        method: 'POST',
        body: JSON.stringify({
          number,
          title,
          version,
          status,
          deciders,
          context,
          decision,
          consequences,
        }),
      });
      await loadAdrs();
      setSelectedId(res.adr.id);
      setCreateOpen(false);
      onNotify(`Запись ADR-${res.adr.number} добавлена в реестр`);
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Ошибка сохранения ADR'), 'err');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadMarkdown = (adr: AdrRecord) => {
    const md = [
      `# ADR-${adr.number}: ${adr.title}`,
      '',
      `- Версия: v${adr.version}`,
      `- Статус: ${adr.status}`,
      `- Дата: ${adr.date}`,
      `- Авторы: ${adr.deciders}`,
      '',
      '## Контекст',
      adr.context,
      '',
      '## Принятое решение',
      adr.decision,
      '',
      '## Последствия',
      adr.consequences,
      '',
      '## Альтернативы',
      adr.alternatives,
    ].join('\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = adr.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onNotify(`Скачан ${adr.fileName}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <BookMarked className="h-4 w-4 text-[#0077FF]" />
            Реестр архитектурных решений (ADR)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Версионированные решения платформы · Всего записей: {adrs.length}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск ADR..."
              className="w-44 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs outline-none focus:border-[#0077FF] focus:bg-white"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadAdrs()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={openNewAdrModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0066DB] whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Новый ADR
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-3 lg:col-span-5">
          {filtered.map((adr) => {
            const isSelected = activeAdr?.id === adr.id;
            return (
              <button
                key={adr.id}
                type="button"
                onClick={() => setSelectedId(adr.id)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  isSelected
                    ? 'border-[#0077FF] bg-blue-50/40'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
                  <span>ADR-{adr.number}</span>
                  <span>
                    {adr.status} · v{adr.version}
                  </span>
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-900">{adr.title}</div>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
          {!activeAdr ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Выберите ADR из списка слева
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="text-[11px] font-mono text-slate-500">
                    ADR-{activeAdr.number} · v{activeAdr.version} · {activeAdr.status} ·{' '}
                    {activeAdr.date}
                  </div>
                  <h4 className="mt-1 text-base font-bold text-slate-900">{activeAdr.title}</h4>
                  <div className="mt-1 text-xs text-slate-500">{activeAdr.deciders}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadMarkdown(activeAdr)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  Скачать .md
                </button>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-slate-700">
                <div>
                  <div className="font-semibold text-slate-900">Контекст</div>
                  <p className="mt-1">{activeAdr.context}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Принятое решение</div>
                  <p className="mt-1">{activeAdr.decision}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Последствия</div>
                  <p className="mt-1">{activeAdr.consequences}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Альтернативы</div>
                  <p className="mt-1 text-slate-600">{activeAdr.alternatives}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Создать Architecture Decision Record (ADR)"
        subtitle="Фиксация архитектурного решения с SemVer версионированием"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleCreateAdr} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Номер (4 цифры)</label>
              <input
                type="text"
                required
                pattern="\d{4}"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-[#0077FF]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Версия SemVer</label>
              <input
                type="text"
                required
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-[#0077FF]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Статус</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AdrRecord['status'])}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-[#0077FF]"
              >
                <option value="Accepted">Accepted</option>
                <option value="Proposed">Proposed</option>
                <option value="Deprecated">Deprecated</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Заголовок</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Использование pgvector для поиска по сделкам"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Контекст</label>
            <textarea
              rows={2}
              required
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Решение</label>
            <textarea
              rows={2}
              required
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Последствия</label>
            <textarea
              rows={2}
              required
              value={consequences}
              onChange={(e) => setConsequences(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-[#0066DB] disabled:opacity-60"
            >
              {submitting ? 'Сохранение...' : 'Сохранить ADR'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
