import React, { useMemo, useState } from 'react';
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
import { CheckCircle2, Plus, Send, Sparkles, TrendingUp } from 'lucide-react';
import { refineClient } from '../../application/refine/client.ts';
import {
  calculateConversionRate,
  calculateCtr,
  calculateOpenRate,
  type EmailAbExperiment,
  getExperimentWinner,
  INITIAL_EMAIL_AB_EXPERIMENTS,
} from '../../domain/crm/emailAbTesting.ts';
import { getErrorMessage } from '../../shared/formatters.ts';
import type { EmailTemplateRecord } from './EmailTemplatesWorkspace.tsx';
import { Modal } from './ui/Modal.tsx';

interface EmailAbTestingPanelProps {
  canWrite: boolean;
  onTemplateApplied: (tpl: EmailTemplateRecord) => void;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

export const EmailAbTestingPanel: React.FC<EmailAbTestingPanelProps> = ({
  canWrite,
  onTemplateApplied,
  onNotify,
}) => {
  const [experiments, setExperiments] = useState<EmailAbExperiment[]>(
    INITIAL_EMAIL_AB_EXPERIMENTS
  );
  const [selectedId, setSelectedId] = useState<string>(
    INITIAL_EMAIL_AB_EXPERIMENTS[0].id
  );
  const [applying, setApplying] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [subA, setSubA] = useState('');
  const [bodyA, setBodyA] = useState('');
  const [subB, setSubB] = useState('');
  const [bodyB, setBodyB] = useState('');

  const activeExperiment = useMemo(
    () => experiments.find((e) => e.id === selectedId) || experiments[0],
    [experiments, selectedId]
  );

  const winnerInfo = useMemo(
    () => getExperimentWinner(activeExperiment),
    [activeExperiment]
  );

  const chartData = useMemo(
    () => [
      {
        metric: 'Open Rate %',
        A: calculateOpenRate(activeExperiment.variants[0]),
        B: calculateOpenRate(activeExperiment.variants[1]),
      },
      {
        metric: 'CTR %',
        A: calculateCtr(activeExperiment.variants[0]),
        B: calculateCtr(activeExperiment.variants[1]),
      },
      {
        metric: 'Конверсия %',
        A: calculateConversionRate(activeExperiment.variants[0]),
        B: calculateConversionRate(activeExperiment.variants[1]),
      },
    ],
    [activeExperiment]
  );

  const handleSimulateBatch = (variantId: 'A' | 'B') => {
    setExperiments((prev) =>
      prev.map((exp) => {
        if (exp.id !== activeExperiment.id) return exp;
        const nextVariants = exp.variants.map((v) => {
          if (v.id !== variantId) return v;
          const isB = variantId === 'B';
          return {
            ...v,
            sentCount: v.sentCount + 50,
            deliveredCount: v.deliveredCount + 49,
            openedCount: v.openedCount + (isB ? 31 : 22),
            clickedCount: v.clickedCount + (isB ? 15 : 8),
            repliedCount: v.repliedCount + (isB ? 7 : 3),
            convertedCount: v.convertedCount + (isB ? 6 : 3),
            revenue: v.revenue + (isB ? 1_800_000 : 900_000),
          };
        }) as EmailAbExperiment['variants'];
        return {
          ...exp,
          statisticalConfidence: Math.min(99.5, Number((exp.statisticalConfidence + 0.6).toFixed(1))),
          variants: nextVariants,
        };
      })
    );
    onNotify(`Зафиксирована серия из 50 отправок по варианту ${variantId}`);
  };

  const handleApplyWinnerToCrm = async () => {
    if (!canWrite) {
      onNotify('Недостаточно прав (требуется deals:write)', 'err');
      return;
    }
    setApplying(true);
    try {
      const win = winnerInfo.winner;
      const res = await refineClient.request<{ template: EmailTemplateRecord }>(
        '/api/crm/email-templates',
        {
          method: 'POST',
          body: JSON.stringify({
            name: `[A/B Победитель ${win.id}] ${activeExperiment.title}`.slice(0, 78),
            category: activeExperiment.category === 'contract' ? 'contract' : 'followup',
            subject: win.subject,
            body: win.body,
          }),
        }
      );
      setExperiments((prev) =>
        prev.map((exp) =>
          exp.id === activeExperiment.id
            ? { ...exp, status: 'completed', appliedVariantId: win.id }
            : exp
        )
      );
      onTemplateApplied(res.template);
      onNotify(`Вариант ${win.id} сохранён как активный шаблон CRM`);
    } catch (err: unknown) {
      onNotify(getErrorMessage(err, 'Не удалось применить шаблон'), 'err');
    } finally {
      setApplying(false);
    }
  };

  const handleCreateExperiment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !subA.trim() || !subB.trim()) {
      onNotify('Укажите название теста и темы для вариантов A и B', 'err');
      return;
    }
    const created: EmailAbExperiment = {
      id: `exp_${Date.now().toString(36)}`,
      title: newTitle.trim(),
      description: newDesc.trim() || 'Сплит-тест эффективности тем и оффера для B2B-клиентов.',
      category: 'proposal',
      status: 'running',
      startDate: new Date().toISOString().slice(0, 10),
      trafficSplit: '50% / 50%',
      primaryMetric: 'conversion_rate',
      statisticalConfidence: 78.0,
      variants: [
        {
          id: 'A',
          name: 'Вариант A (Контроль)',
          subject: subA.trim(),
          preheader: 'Контрольная версия письма',
          body: bodyA.trim() || 'Здравствуйте, {{contactName}}! Направляем детали по {{dealTitle}}.',
          ctaText: 'Подробнее',
          sentCount: 100,
          deliveredCount: 98,
          openedCount: 41,
          clickedCount: 14,
          repliedCount: 5,
          convertedCount: 6,
          revenue: 1_500_000,
        },
        {
          id: 'B',
          name: 'Вариант B (Гипотеза)',
          subject: subB.trim(),
          preheader: 'Тестовая гипотеза оффера',
          body: bodyB.trim() || 'Здравствуйте, {{contactName}}! Подготовили расчёт ROI для {{companyName}}.',
          ctaText: 'Запустить пилот',
          sentCount: 100,
          deliveredCount: 99,
          openedCount: 54,
          clickedCount: 23,
          repliedCount: 9,
          convertedCount: 10,
          revenue: 2_600_000,
        },
      ],
    };
    setExperiments((prev) => [created, ...prev]);
    setSelectedId(created.id);
    setCreateOpen(false);
    setNewTitle('');
    setNewDesc('');
    setSubA('');
    setBodyA('');
    setSubB('');
    setBodyB('');
    onNotify('A/B-эксперимент рассылки создан');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {experiments.map((exp) => (
            <button
              key={exp.id}
              type="button"
              onClick={() => setSelectedId(exp.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                exp.id === activeExperiment.id
                  ? 'border-[#0077FF] bg-blue-50/60 text-[#0077FF]'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {exp.title.length > 42 ? `${exp.title.slice(0, 42)}...` : exp.title}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          Новый A/B тест
        </button>
      </div>

      {/* Selected Experiment Summary + Recharts Bar Chart */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-5 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>Сплит {activeExperiment.trafficSplit} · Старт {activeExperiment.startDate}</span>
              <span className="font-semibold text-emerald-700 tabular-nums">
                Доверие: {activeExperiment.statisticalConfidence}%
              </span>
            </div>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">
              {activeExperiment.title}
            </h3>
            <p className="mt-1 text-xs text-slate-600">{activeExperiment.description}</p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
              <TrendingUp className="h-3.5 w-3.5" />
              Лидер: {winnerInfo.winner.name}
            </div>
            <div className="mt-1 text-slate-700 tabular-nums">
              Прирост ключевой метрики: +{winnerInfo.metricLiftPct}% · Выручка по варианту:{' '}
              {winnerInfo.winner.revenue.toLocaleString('ru-RU')} ₽
            </div>
          </div>

          {canWrite && (
            <button
              type="button"
              onClick={() => void handleApplyWinnerToCrm()}
              disabled={applying}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0077FF] px-3 py-2 text-xs font-medium text-white hover:bg-[#0066DB] disabled:opacity-60"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {applying ? 'Сохранение...' : `Сохранить вариант ${winnerInfo.winner.id} в шаблоны CRM`}
            </button>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-7">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900">Сравнение воронки писем (A vs B)</span>
            <span className="text-slate-500">Open Rate · CTR · Конверсия в сделку</span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} unit="%" />
                <Tooltip formatter={(val: unknown) => `${val}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="A" name="Вариант A" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="B" name="Вариант B" fill="#0077FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Variants Detailed Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {activeExperiment.variants.map((variant) => {
          const isWinner = variant.id === winnerInfo.winner.id;
          return (
            <div
              key={variant.id}
              className={`rounded-xl border bg-white p-4 space-y-3 ${
                isWinner ? 'border-[#0077FF]' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                    <span>{variant.name}</span>
                    {isWinner && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0077FF]">
                        <Sparkles className="h-3 w-3" /> Лидер
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-800">
                    Тема: {variant.subject}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSimulateBatch(variant.id as 'A' | 'B')}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <Send className="h-3 w-3" /> +50 писем
                </button>
              </div>

              <p className="whitespace-pre-line rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
                {variant.body}
              </p>

              <div className="grid grid-cols-4 gap-2 border-t border-slate-100 pt-2 text-center text-xs tabular-nums">
                <div>
                  <div className="text-[11px] text-slate-400">Отправлено</div>
                  <div className="font-semibold text-slate-900">{variant.sentCount}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Open Rate</div>
                  <div className="font-semibold text-slate-900">{calculateOpenRate(variant)}%</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">CTR</div>
                  <div className="font-semibold text-slate-900">{calculateCtr(variant)}%</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Конверсия</div>
                  <div className="font-semibold text-[#0077FF]">
                    {calculateConversionRate(variant)}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новый A/B эксперимент рассылки"
        subtitle="Сравнение тем и текста писем для воронки CRM"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleCreateExperiment} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Название эксперимента
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Например: Оффер со скидкой 10% vs бесплатный аудит"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Описание</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Гипотеза сплит-теста"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Тема A</label>
              <input
                type="text"
                required
                value={subA}
                onChange={(e) => setSubA(e.target.value)}
                placeholder="Тема варианта A"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              />
              <textarea
                rows={3}
                value={bodyA}
                onChange={(e) => setBodyA(e.target.value)}
                placeholder="Текст варианта A..."
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Тема B</label>
              <input
                type="text"
                required
                value={subB}
                onChange={(e) => setSubB(e.target.value)}
                placeholder="Тема варианта B"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              />
              <textarea
                rows={3}
                value={bodyB}
                onChange={(e) => setBodyB(e.target.value)}
                placeholder="Текст варианта B..."
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              />
            </div>
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
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-[#0066DB]"
            >
              Запустить тест
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
