import React, { useState } from 'react';
import { CheckCircle2, Heart, Layers, Package, Plus, TrendingUp } from 'lucide-react';
import { DealCard } from './ui/DealCard.tsx';
import { EmptyState } from './ui/EmptyState.tsx';
import { Modal } from './ui/Modal.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { StatCard } from './ui/StatCard.tsx';

type StoryKey =
  | 'deal_card'
  | 'stat_card'
  | 'page_header'
  | 'empty_state'
  | 'modal'
  | 'social_post'
  | 'plugin_card';

export const StorybookCatalog: React.FC = () => {
  const [selectedStory, setSelectedStory] = useState<StoryKey>('deal_card');
  const [dealHasOverdue, setDealHasOverdue] = useState(false);
  const [dealShowHarness, setDealShowHarness] = useState(true);
  const [statTone, setStatTone] = useState<'default' | 'accent' | 'positive' | 'danger'>('accent');
  const [showHeaderAction, setShowHeaderAction] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [postLiked, setPostLiked] = useState(true);
  const [pluginEnabled, setPluginEnabled] = useState(true);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-4">
        <div className="text-xs font-semibold text-slate-500">Storybook UI Kit · Единые примитивы</div>
        <div className="mt-3 space-y-1">
          {(
            [
              ['deal_card', 'ui/DealCard.tsx'],
              ['stat_card', 'ui/StatCard.tsx'],
              ['page_header', 'ui/PageHeader.tsx'],
              ['empty_state', 'ui/EmptyState.tsx'],
              ['modal', 'ui/Modal.tsx'],
              ['social_post', 'Social / VkFeedPost'],
              ['plugin_card', 'Market / VerdaccioPluginCard'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedStory(key)}
              className={`w-full rounded-lg px-3 py-2 text-left font-mono text-xs transition-colors ${
                selectedStory === key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <div className="text-xs font-semibold text-slate-900">Controls (Args)</div>
          <div className="mt-3 space-y-2 text-xs text-slate-700">
            {selectedStory === 'deal_card' && (
              <>
                <label className="flex items-center justify-between">
                  <span>hasOverdueTask</span>
                  <input
                    type="checkbox"
                    checked={dealHasOverdue}
                    onChange={(e) => setDealHasOverdue(e.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span>harnessAnalysis</span>
                  <input
                    type="checkbox"
                    checked={dealShowHarness}
                    onChange={(e) => setDealShowHarness(e.target.checked)}
                  />
                </label>
              </>
            )}
            {selectedStory === 'stat_card' && (
              <label className="flex items-center justify-between gap-2">
                <span>tone</span>
                <select
                  value={statTone}
                  onChange={(e) => setStatTone(e.target.value as typeof statTone)}
                  className="rounded border border-slate-200 px-2 py-1 text-xs"
                >
                  <option value="default">default</option>
                  <option value="accent">accent</option>
                  <option value="positive">positive</option>
                  <option value="danger">danger</option>
                </select>
              </label>
            )}
            {selectedStory === 'page_header' && (
              <label className="flex items-center justify-between">
                <span>actions</span>
                <input
                  type="checkbox"
                  checked={showHeaderAction}
                  onChange={(e) => setShowHeaderAction(e.target.checked)}
                />
              </label>
            )}
            {selectedStory === 'social_post' && (
              <label className="flex items-center justify-between">
                <span>likedByMe</span>
                <input
                  type="checkbox"
                  checked={postLiked}
                  onChange={(e) => setPostLiked(e.target.checked)}
                />
              </label>
            )}
            {selectedStory === 'plugin_card' && (
              <label className="flex items-center justify-between">
                <span>enabled</span>
                <input
                  type="checkbox"
                  checked={pluginEnabled}
                  onChange={(e) => setPluginEnabled(e.target.checked)}
                />
              </label>
            )}
            {(selectedStory === 'empty_state' || selectedStory === 'modal') && (
              <div className="text-slate-500">Взаимодействуйте с элементом на холсте справа.</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-10 lg:col-span-8">
        {selectedStory === 'deal_card' && (
          <div className="w-full max-w-xs">
            <DealCard
              title="NordStar Logistics — Внедрение Enterprise CRM"
              budget={2450000}
              currency="RUB"
              companyName="NordStar Logistics"
              contactName="Виктор Громов"
              ownerName="Елена Смирнова"
              openTasksCount={2}
              hasOverdueTask={dealHasOverdue}
              tags={['Enterprise', 'Годовой контракт']}
              harnessAnalysis={
                dealShowHarness
                  ? {
                      dealId: 'deal_demo',
                      runId: 'hrun_demo',
                      winProbability: dealHasOverdue ? 48 : 84,
                      riskLevel: dealHasOverdue ? 'Высокий' : 'Низкий',
                      contactHistorySummary: 'Касаний: 4 · Открытых задач: 2',
                      historySignalsCount: 4,
                      siblingDealsCount: 1,
                      nextStep: {
                        actionType: 'meeting',
                        title: 'Согласовать финальный SLA и график оплаты',
                        rationale: 'Поздний этап воронки',
                        suggestedDueAt: new Date().toISOString(),
                      },
                      analyzedAt: new Date().toISOString(),
                      trigger: 'manual_card',
                    }
                  : null
              }
            />
          </div>
        )}

        {selectedStory === 'stat_card' && (
          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            <StatCard
              label="Активная воронка"
              value="4 000 000 ₽"
              hint="4 сделки в работе"
              tone={statTone}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              label="Выиграно"
              value="2 450 000 ₽"
              hint="Конверсия 33%"
              tone="positive"
            />
          </div>
        )}

        {selectedStory === 'page_header' && (
          <div className="w-full">
            <PageHeader
              title="Воронка сделок amoCRM"
              subtitle="Сделок: 12 · Сумма: 6 450 000 ₽"
              actions={
                showHeaderAction ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-1.5 text-xs font-medium text-white"
                  >
                    <Plus className="h-3.5 w-3.5" /> Новая сделка
                  </button>
                ) : undefined
              }
            />
          </div>
        )}

        {selectedStory === 'empty_state' && (
          <div className="w-full max-w-md">
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title="Список записей пуст"
              description="Создайте первый элемент или измените активные фильтры таблицы."
            />
          </div>
        )}

        {selectedStory === 'modal' && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Открыть предпросмотр Modal
            </button>
            <Modal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              title="Пример диалогового окна"
              subtitle="Унифицированный контейнер ui/Modal.tsx с доступным закрытием по Escape"
            >
              <div className="space-y-4 text-xs text-slate-600">
                <p>Используется во всех модулях CRM, NocoBase, Verdaccio и Администрирования.</p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-lg bg-[#0077FF] px-4 py-1.5 font-medium text-white"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            </Modal>
          </div>
        )}

        {selectedStory === 'social_post' && (
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-sm font-semibold text-slate-900">Елена Смирнова</div>
            <div className="text-xs text-slate-400">Сегодня в 14:20</div>
            <p className="mt-2.5 text-sm text-slate-700">
              Запустили новый контур автоматизации в amoCRM через DeepSeek-Harness и NATS!
            </p>
            <div className="mt-3 border-t border-slate-100 pt-2.5">
              <button
                type="button"
                onClick={() => setPostLiked((v) => !v)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                  postLiked ? 'text-red-600' : 'text-slate-500'
                }`}
              >
                <Heart className={`h-4 w-4 ${postLiked ? 'fill-red-600' : ''}`} />
                <span className="tabular-nums">{postLiked ? 15 : 14}</span>
              </button>
            </div>
          </div>
        )}

        {selectedStory === 'plugin_card' && (
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-blue-600">@nexus-plugins/dify-deal-copilot</div>
                <div className="mt-1 text-base font-semibold text-slate-900">Dify Deal Copilot</div>
              </div>
              <Package className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-2 text-xs text-slate-500">v1.4.2 · Слот: crm_deal_sidebar</div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                <Layers className="h-3.5 w-3.5" /> Verdaccio
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${
                  pluginEnabled ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {pluginEnabled ? 'Активен' : 'Выключен'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
