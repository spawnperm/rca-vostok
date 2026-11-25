import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Cpu,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Kanban,
  LayoutList,
  Mail,
  Plus,
  Presentation,
  Send,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import {
  type DealsReportContext,
  exportDealContractPdf,
  exportDealsToPdf,
  exportDealsToXlsx,
} from '../../application/crm/dealsReportExporter.ts';
import { refineClient } from '../../application/refine/client.ts';
import { useVoiceSectionAction } from '../../application/voice/voiceActionBus.ts';
import {
  normalizeVoiceCommandText,
  type DealPriorityLevel,
} from '../../application/voice/voiceNavigation.ts';
import { computeDealScore } from '../../domain/crm/dealIntelligence.ts';
import { buildDealEmailContext, renderEmailTemplate } from '../../domain/crm/entities.ts';
import type { AuthenticatedActor } from '../../domain/shared/types.ts';
import { CrmExportMenu } from '../components/crm/CrmExportMenu.tsx';
import { CrmImportModal } from '../components/crm/CrmImportModal.tsx';
import { DealContextMenu } from '../components/crm/DealContextMenu.tsx';
import { VoiceSearchInput } from '../components/crm/VoiceSearchInput.tsx';
import { DealsGanttView } from '../components/DealsGanttView.tsx';

const DealsAnalyticsView = lazy(() =>
  import('../components/DealsAnalyticsView.tsx').then((m) => ({ default: m.DealsAnalyticsView }))
);
import { EmailTemplatesModal, type EmailTemplateRecord } from '../components/EmailTemplatesModal.tsx';
import { DealCard } from '../components/ui/DealCard.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import type {
  CompanyItem,
  ContactItem,
  DealHarnessAnalysis,
  DealItem,
  OwnerOption,
  PipelineItem,
  StageItem,
} from '../types.ts';

interface TimelineEventItem {
  id: string;
  type: string;
  body: string;
  authorName: string;
  createdAt: string;
}

interface DealsPipelineViewProps {
  actor: AuthenticatedActor;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
  onOpenOfficeDoc?: (docId: string) => void;
}

interface LinkedOfficeDoc {
  id: string;
  title: string;
  kind: 'xlsx' | 'docx' | 'pptx';
  latestCommitSha: string | null;
  sizeBytes: number;
  updatedAt: string;
}

export function resolveDealForVoiceCommand(
  deals: DealItem[],
  selectedDealId: string | null,
  focusedDealId: string | null,
  dealQuery?: string
): DealItem | null {
  if (deals.length === 0) return null;
  if (dealQuery && dealQuery.trim()) {
    const q = normalizeVoiceCommandText(dealQuery);
    const exact = deals.find((d) => normalizeVoiceCommandText(d.title) === q);
    if (exact) return exact;
    const partial = deals.find(
      (d) =>
        normalizeVoiceCommandText(d.title).includes(q) ||
        normalizeVoiceCommandText(d.companyName || '').includes(q) ||
        normalizeVoiceCommandText(d.contactName || '').includes(q)
    );
    if (partial) return partial;
    const tokens = q.split(' ').filter((t) => t.length >= 3);
    if (tokens.length > 0) {
      const tokenMatch = deals.find((d) => {
        const hay = normalizeVoiceCommandText(
          `${d.title} ${d.companyName || ''} ${d.contactName || ''}`
        );
        return tokens.every((tok) => hay.includes(tok));
      });
      if (tokenMatch) return tokenMatch;
    }
    return null;
  }

  if (selectedDealId) {
    const selected = deals.find((d) => d.id === selectedDealId);
    if (selected) return selected;
  }
  if (focusedDealId) {
    const focused = deals.find((d) => d.id === focusedDealId);
    if (focused) return focused;
  }
  return deals[0] || null;
}

export function resolveStageByVoiceQuery(
  stages: StageItem[],
  stageQuery: string
): StageItem | null {
  if (stages.length === 0 || !stageQuery.trim()) return null;
  const q = normalizeVoiceCommandText(stageQuery);
  if (!q) return null;

  const sorted = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);

  // 1. Exact or substring match against stage names
  const exact = sorted.find((s) => normalizeVoiceCommandText(s.name) === q);
  if (exact) return exact;

  const sub = sorted.find(
    (s) =>
      normalizeVoiceCommandText(s.name).includes(q) ||
      q.includes(normalizeVoiceCommandText(s.name))
  );
  if (sub) return sub;

  // 2. Prefix / stem matching across tokens
  const qTokens = q.split(' ').filter((t) => t.length >= 3);
  if (qTokens.length > 0) {
    const stemMatch = sorted.find((s) => {
      const nameNorm = normalizeVoiceCommandText(s.name);
      return qTokens.some((tok) => nameNorm.includes(tok.slice(0, Math.min(5, tok.length))));
    });
    if (stemMatch) return stemMatch;
  }

  // 3. Semantic amoCRM pipeline stage synonyms
  if (/(?:оплат|оплачен|выигран|успешн|побед|закрыт.*успеш|won|paid|payment)/.test(q)) {
    return sorted.find((s) => s.isWon) || sorted.find((s) => !s.isLost && s.sortOrder === sorted.length - 1) || null;
  }
  if (/(?:отказ|проигран|потер|не реализован|lost|reject|cancel)/.test(q)) {
    return sorted.find((s) => s.isLost) || null;
  }
  if (/(?:неразобран|нов|лид|входящ|new|unsorted|lead)/.test(q)) {
    return sorted.find((s) => !s.isWon && !s.isLost && s.sortOrder === 1) || sorted[0] || null;
  }
  if (/(?:контакт|звонок|квалификац|contact|qualif)/.test(q)) {
    return (
      sorted.find((s) => /(?:контакт|квалификац)/.test(normalizeVoiceCommandText(s.name))) ||
      sorted.find((s) => !s.isWon && !s.isLost && s.sortOrder === 2) ||
      null
    );
  }
  if (/(?:переговор|встреч|negotiat)/.test(q)) {
    return (
      sorted.find((s) => /переговор/.test(normalizeVoiceCommandText(s.name))) ||
      sorted.find((s) => !s.isWon && !s.isLost && s.sortOrder === 3) ||
      null
    );
  }
  if (/(?:решени|согласован|договор|предложен|кп|счет|decision|proposal|offer)/.test(q)) {
    return (
      sorted.find((s) => /(?:решени|предложен|договор|счет)/.test(normalizeVoiceCommandText(s.name))) ||
      sorted.find((s) => !s.isWon && !s.isLost && s.sortOrder === 4) ||
      null
    );
  }

  return null;
}

export function resolveOwnerByVoiceQuery(
  owners: OwnerOption[],
  ownerQuery: string
): OwnerOption | null {
  if (owners.length === 0 || !ownerQuery.trim()) return null;
  const q = normalizeVoiceCommandText(ownerQuery);
  const exact = owners.find((o) => normalizeVoiceCommandText(o.fullName) === q);
  if (exact) return exact;

  const partial = owners.find((o) => normalizeVoiceCommandText(o.fullName).includes(q));
  if (partial) return partial;

  const tokens = q.split(' ').filter((t) => t.length >= 3);
  if (tokens.length > 0) {
    return (
      owners.find((o) => {
        const nameNorm = normalizeVoiceCommandText(o.fullName);
        return tokens.some((tok) => nameNorm.includes(tok.slice(0, Math.min(5, tok.length))));
      }) || null
    );
  }
  return null;
}

export const DealsPipelineView: React.FC<DealsPipelineViewProps> = ({
  actor,
  onNotify,
  onOpenOfficeDoc,
}) => {
  const [pipelines, setPipelines] = useState<PipelineItem[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [stages, setStages] = useState<StageItem[]>([]);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [owners, setOwners] = useState<OwnerOption[]>([]);

  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'gantt' | 'analytics'>('kanban');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'Высокий' | 'Средний' | 'Низкий'>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [focusedDealId, setFocusedDealId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    dealId: string;
    x: number;
    y: number;
  } | null>(null);

  // Deal Drawer State
  const [selectedDeal, setSelectedDeal] = useState<DealItem | null>(null);
  const [timeline, setTimeline] = useState<TimelineEventItem[]>([]);
  const [noteBody, setNoteBody] = useState('');
  const [noteType, setNoteType] = useState<'note' | 'call' | 'email'>('note');

  // Editable Deal Fields inside Drawer
  const [editTitle, setEditTitle] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editContactId, setEditContactId] = useState('');
  const [editCompanyId, setEditCompanyId] = useState('');
  const [editOwnerId, setEditOwnerId] = useState('');
  const [savingDealFields, setSavingDealFields] = useState(false);

  // Quick Task / Meeting inside Deal Drawer
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskType, setQuickTaskType] = useState<'meeting' | 'followup' | 'call'>('meeting');
  const [quickTaskDue, setQuickTaskDue] = useState(() =>
    new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16)
  );

  // Unified AI Copilot (Harness + Dify)
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [analyzingDealId, setAnalyzingDealId] = useState<string | null>(null);
  const [applyingNextStep, setApplyingNextStep] = useState(false);
  const [draftingEmail, setDraftingEmail] = useState(false);

  // Email Composer & Templates
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);

  // Linked Office Docs
  const [dealDocs, setDealDocs] = useState<LinkedOfficeDoc[]>([]);
  const [creatingOfficeDocKind, setCreatingOfficeDocKind] = useState<'xlsx' | 'docx' | 'pptx' | null>(null);

  // Modals: New Deal & New Pipeline
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBudget, setNewBudget] = useState('500000');
  const [newStageId, setNewStageId] = useState('');
  const [newContactId, setNewContactId] = useState('');
  const [newCompanyId, setNewCompanyId] = useState('');
  const [showNewPipelineModal, setShowNewPipelineModal] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);

  const canWrite = refineClient.can(actor, 'deals:write');
  const canDelete = refineClient.can(actor, 'deals:delete');
  const canHarness = refineClient.can(actor, 'harness:execute');
  const canCreateTask = refineClient.can(actor, 'tasks:write');

  useVoiceSectionAction('deals', (actionId, payload) => {
    switch (actionId) {
      case 'deals.create_deal':
        if (!canWrite) return false;
        setShowNewModal(true);
        return true;
      case 'deals.create_pipeline':
        if (!canWrite) return false;
        setShowNewPipelineModal(true);
        return true;
      case 'deals.view_kanban':
        setViewMode('kanban');
        return true;
      case 'deals.view_list':
        setViewMode('list');
        return true;
      case 'deals.view_gantt':
        setViewMode('gantt');
        return true;
      case 'deals.view_analytics':
        setViewMode('analytics');
        return true;
      case 'deals.ai_scoring':
        if (!canHarness) return false;
        void handleAnalyzeAllDeals();
        return true;
      case 'deals.move_stage': {
        if (!canWrite) return false;
        const pool = payload?.dealQuery
          ? deals.filter((d) => !selectedPipelineId || d.pipelineId === selectedPipelineId)
          : filteredDeals.length > 0
          ? filteredDeals
          : deals;
        const targetDeal = resolveDealForVoiceCommand(
          pool,
          selectedDeal?.id || null,
          focusedDealId,
          payload?.dealQuery
        );
        if (!targetDeal) {
          onNotify(
            payload?.dealQuery
              ? `Сделка «${payload.dealQuery}» не найдена`
              : 'Выберите сделку для смены этапа',
            'err'
          );
          return false;
        }
        if (actor.dataScope === 'own' && targetDeal.ownerId !== actor.userId) {
          onNotify('ACL Data Scope (own): нельзя менять этап чужой сделки', 'err');
          return false;
        }
        const pipelineStages = stages
          .filter((s) => s.pipelineId === targetDeal.pipelineId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const stagePool = pipelineStages.length > 0 ? pipelineStages : activeStages;
        const targetStage = resolveStageByVoiceQuery(stagePool, payload?.stageQuery || '');
        if (!targetStage) {
          onNotify(
            `Этап «${payload?.stageQuery || ''}» не найден. Доступны: ${stagePool
              .map((s) => s.name)
              .join(', ')}`,
            'err'
          );
          return false;
        }
        setFocusedDealId(targetDeal.id);
        void handleMoveStage(targetDeal.id, targetStage.id, targetDeal.title, targetStage.name);
        return true;
      }
      case 'deals.set_priority': {
        if (!canWrite || !payload?.priority) return false;
        const pool = payload?.dealQuery
          ? deals.filter((d) => !selectedPipelineId || d.pipelineId === selectedPipelineId)
          : filteredDeals.length > 0
          ? filteredDeals
          : deals;
        const targetDeal = resolveDealForVoiceCommand(
          pool,
          selectedDeal?.id || null,
          focusedDealId,
          payload?.dealQuery
        );
        if (!targetDeal) {
          onNotify(
            payload?.dealQuery
              ? `Сделка «${payload.dealQuery}» не найдена`
              : 'Выберите сделку для установки приоритета',
            'err'
          );
          return false;
        }
        if (actor.dataScope === 'own' && targetDeal.ownerId !== actor.userId) {
          onNotify('ACL Data Scope (own): нельзя менять приоритет чужой сделки', 'err');
          return false;
        }
        setFocusedDealId(targetDeal.id);
        void handleSetDealPriority(targetDeal.id, payload.priority);
        return true;
      }
      case 'deals.assign_owner': {
        if (!canWrite) return false;
        const pool = payload?.dealQuery
          ? deals.filter((d) => !selectedPipelineId || d.pipelineId === selectedPipelineId)
          : filteredDeals.length > 0
          ? filteredDeals
          : deals;
        const targetDeal = resolveDealForVoiceCommand(
          pool,
          selectedDeal?.id || null,
          focusedDealId,
          payload?.dealQuery
        );
        if (!targetDeal) {
          onNotify('Сделка для назначения ответственного не найдена', 'err');
          return false;
        }
        const targetOwner = resolveOwnerByVoiceQuery(owners, payload?.ownerQuery || '');
        if (!targetOwner) {
          onNotify(`Менеджер «${payload?.ownerQuery || ''}» не найден`, 'err');
          return false;
        }
        setFocusedDealId(targetDeal.id);
        void handleReassignDealOwner(targetDeal.id, targetOwner.id);
        return true;
      }
      case 'deals.import':
        if (!canWrite) return false;
        setImportModalOpen(true);
        return true;
      case 'deals.refresh':
        void fetchDeals();
        return true;
      default:
        return false;
    }
  });

  const fetchDeals = useCallback(async (): Promise<DealItem[]> => {
    setLoading(true);
    try {
      const [data, tplData] = await Promise.all([
        refineClient.request<{
          pipelines: PipelineItem[];
          stages: StageItem[];
          deals: DealItem[];
          contacts: ContactItem[];
          companies: CompanyItem[];
          owners: OwnerOption[];
        }>('/api/crm/deals'),
        refineClient.request<{ templates: EmailTemplateRecord[] }>('/api/crm/email-templates'),
      ]);

      setPipelines(data.pipelines);
      setStages(data.stages);
      setDeals(data.deals);
      setContacts(data.contacts);
      setCompanies(data.companies);
      setOwners(data.owners || []);
      setEmailTemplates(tplData.templates);

      setSelectedPipelineId((prev) => {
        if (prev && data.pipelines.some((p) => p.id === prev)) return prev;
        return data.pipelines.find((p) => p.isDefault)?.id || data.pipelines[0]?.id || '';
      });
      return data.deals;
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка загрузки воронки', 'err');
      return [];
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void fetchDeals();
  }, [fetchDeals]);

  const activeStages = useMemo(
    () =>
      stages
        .filter((s) => !selectedPipelineId || s.pipelineId === selectedPipelineId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [stages, selectedPipelineId]
  );

  useEffect(() => {
    if (activeStages.length > 0 && !activeStages.some((s) => s.id === newStageId)) {
      setNewStageId(activeStages[0].id);
    }
  }, [activeStages, newStageId]);

  const applyTemplateObjectToDeal = useCallback(
    (tpl: EmailTemplateRecord, deal: DealItem) => {
      const ctx = buildDealEmailContext(deal, stages);
      setSelectedTemplateId(tpl.id);
      setEmailSubject(renderEmailTemplate(tpl.subject, ctx));
      setEmailBody(renderEmailTemplate(tpl.body, ctx));
    },
    [stages]
  );

  const loadDealDetails = useCallback(
    async (deal: DealItem) => {
      try {
        const [tlRes, docRes] = await Promise.all([
          refineClient.request<{ events: TimelineEventItem[] }>(`/api/crm/deals/${deal.id}/timeline`),
          refineClient.request<{ documents: LinkedOfficeDoc[] }>(
            `/api/office/workspace?dealId=${encodeURIComponent(deal.id)}`
          ),
        ]);
        setTimeline(tlRes.events);
        setDealDocs(docRes.documents || []);
      } catch {
        setTimeline([]);
        setDealDocs([]);
      }
    },
    []
  );

  const openDealDrawer = (deal: DealItem) => {
    setFocusedDealId(deal.id);
    setSelectedDeal(deal);
    setEditTitle(deal.title);
    setEditBudget(String(deal.budget));
    setEditContactId(deal.contactId || '');
    setEditCompanyId(deal.companyId || '');
    setEditOwnerId(deal.ownerId || '');
    setEmailTo(deal.contactEmail || '');
    setQuickTaskTitle('');

    if (emailTemplates.length > 0) {
      applyTemplateObjectToDeal(emailTemplates[0], deal);
    } else {
      setSelectedTemplateId('');
      setEmailSubject(`По сделке «${deal.title}»`);
      setEmailBody('');
    }
    void loadDealDetails(deal);
  };

  const handleSaveDealFields = async () => {
    if (!selectedDeal || !canWrite) return;
    setSavingDealFields(true);
    try {
      await refineClient.request(`/api/crm/deals/${selectedDeal.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editTitle.trim(),
          budget: Number(editBudget) || 0,
          contactId: editContactId || null,
          companyId: editCompanyId || null,
          ownerId: editOwnerId || selectedDeal.ownerId,
        }),
      });
      onNotify('Карточка сделки обновлена');
      const freshDeals = await fetchDeals();
      const refreshed = freshDeals.find((d) => d.id === selectedDeal.id);
      if (refreshed) setSelectedDeal(refreshed);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка сохранения сделки', 'err');
    } finally {
      setSavingDealFields(false);
    }
  };

  const handleAutoAssignDeal = async (dealId: string) => {
    if (!canWrite) return;
    try {
      const res = await refineClient.request<{
        recommendation: { ownerId: string; ownerName: string; reason: string };
      }>(`/api/crm/deals/${dealId}/auto-assign`, {
        method: 'POST',
      });
      setEditOwnerId(res.recommendation.ownerId);
      const freshDeals = await fetchDeals();
      const refreshed = freshDeals.find((d) => d.id === dealId);
      if (refreshed && selectedDeal?.id === dealId) {
        setSelectedDeal(refreshed);
        void loadDealDetails(refreshed);
      }
      onNotify(`Назначен ${res.recommendation.ownerName} (${res.recommendation.reason})`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка авто-назначения менеджера', 'err');
    }
  };

  const handleExportSingleDealPdf = async (
    deal: DealItem,
    templateKind: 'proposal' | 'contract'
  ) => {
    try {
      const stageName = activeStages.find((s) => s.id === deal.stageId)?.name || 'Воронка';
      const pipelineName = pipelines.find((p) => p.id === deal.pipelineId)?.name || 'Основная';
      const fileName = await exportDealContractPdf({
        deal,
        stageName,
        pipelineName,
        templateKind,
      });
      onNotify(`Сформирован PDF-документ ${fileName}`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка генерации PDF', 'err');
    }
  };

  const handleAnalyzeAllDeals = async () => {
    if (!canHarness) return;
    setAnalyzingAll(true);
    try {
      const res = await refineClient.request<{ count: number; analyses: DealHarnessAnalysis[] }>(
        '/api/crm/deals/analyze-all',
        { method: 'POST' }
      );
      const map = new Map(res.analyses.map((a) => [a.dealId, a]));
      setDeals((prev) =>
        prev.map((d) => (map.has(d.id) ? { ...d, harnessAnalysis: map.get(d.id)! } : d))
      );
      if (selectedDeal && map.has(selectedDeal.id)) {
        setSelectedDeal({ ...selectedDeal, harnessAnalysis: map.get(selectedDeal.id)! });
      }
      onNotify(`DeepSeek-Harness пересчитал рекомендации для ${res.count} сделок`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка пакетного анализа', 'err');
    } finally {
      setAnalyzingAll(false);
    }
  };

  const handleAnalyzeDeal = async (dealId: string) => {
    if (!canHarness) return;
    setAnalyzingDealId(dealId);
    try {
      const res = await refineClient.request<{ analysis: DealHarnessAnalysis }>('/api/crm/deals/analyze', {
        method: 'POST',
        body: JSON.stringify({ dealId, trigger: 'manual_card' }),
      });
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, harnessAnalysis: res.analysis } : d))
      );
      if (selectedDeal?.id === dealId) {
        setSelectedDeal({ ...selectedDeal, harnessAnalysis: res.analysis });
      }
      onNotify(`Анализ Harness: шанс ${res.analysis.winProbability}%`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка анализа сделки', 'err');
    } finally {
      setAnalyzingDealId(null);
    }
  };

  const handleGenerateDifyEmailDraft = async (deal: DealItem) => {
    if (!canHarness) return;
    setDraftingEmail(true);
    try {
      const res = await refineClient.request<{
        run: { outputPayload: { draftSubject?: string; draftText?: string } };
      }>('/api/harness/execute', {
        method: 'POST',
        body: JSON.stringify({
          workflowId: 'dify_followup_draft',
          dealId: deal.id,
        }),
      });
      const out = res.run.outputPayload;
      if (out.draftSubject) setEmailSubject(out.draftSubject);
      if (out.draftText) setEmailBody(out.draftText);
      onNotify('Dify сформировал черновик письма в форме отправки');
      await loadDealDetails(deal);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка генерации черновика', 'err');
    } finally {
      setDraftingEmail(false);
    }
  };

  const handleApplyNextStep = async (dealId: string) => {
    if (!canCreateTask) return;
    setApplyingNextStep(true);
    try {
      const res = await refineClient.request<{ task: { title: string } }>(
        `/api/crm/deals/${dealId}/apply-next-step`,
        { method: 'POST' }
      );
      onNotify(`Создана задача: «${res.task.title}»`);
      await Promise.all([
        fetchDeals(),
        selectedDeal ? loadDealDetails(selectedDeal) : Promise.resolve(),
      ]);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Не удалось создать задачу', 'err');
    } finally {
      setApplyingNextStep(false);
    }
  };

  const handleMoveStage = async (
    dealId: string,
    targetStageId: string,
    dealTitleHint?: string,
    stageNameHint?: string
  ) => {
    if (!canWrite) {
      onNotify('Недостаточно прав RBAC (deals:write)', 'err');
      return;
    }
    try {
      const res = await refineClient.request<{ harnessAnalysis?: DealHarnessAnalysis }>(
        `/api/crm/deals/${dealId}/stage`,
        {
          method: 'PATCH',
          body: JSON.stringify({ stageId: targetStageId }),
        }
      );
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId
            ? {
                ...d,
                stageId: targetStageId,
                harnessAnalysis: res.harnessAnalysis || d.harnessAnalysis,
              }
            : d
        )
      );
      if (selectedDeal?.id === dealId) {
        setSelectedDeal((prev) =>
          prev
            ? {
                ...prev,
                stageId: targetStageId,
                harnessAnalysis: res.harnessAnalysis || prev.harnessAnalysis,
              }
            : null
        );
        void loadDealDetails(selectedDeal);
      }
      const resolvedStageName =
        stageNameHint || stages.find((s) => s.id === targetStageId)?.name || '';
      onNotify(
        dealTitleHint && resolvedStageName
          ? `Сделка «${dealTitleHint}» переведена в статус «${resolvedStageName}»`
          : resolvedStageName
          ? `Этап сделки изменён на «${resolvedStageName}»`
          : 'Этап сделки обновлён'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка смены этапа', 'err');
    }
  };

  const handleSetDealPriority = async (dealId: string, priority: DealPriorityLevel) => {
    if (!canWrite) {
      onNotify('Недостаточно прав RBAC (deals:write)', 'err');
      return;
    }
    const prevDeal = deals.find((d) => d.id === dealId);
    if (!prevDeal) return;

    const nextCustomFields = {
      ...(prevDeal.customFields || {}),
      priority,
    };

    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, customFields: nextCustomFields } : d))
    );
    if (selectedDeal?.id === dealId) {
      setSelectedDeal((prev) => (prev ? { ...prev, customFields: nextCustomFields } : null));
    }

    try {
      await refineClient.request(`/api/crm/deals/${dealId}`, {
        method: 'PATCH',
        body: JSON.stringify({ customFields: nextCustomFields }),
      });
      if (selectedDeal?.id === dealId) {
        void loadDealDetails(selectedDeal);
      }
      onNotify(`Приоритет сделки «${prevDeal.title}» установлен: ${priority}`);
    } catch (err: unknown) {
      setDeals((prev) => prev.map((d) => (d.id === dealId ? prevDeal : d)));
      if (selectedDeal?.id === dealId) {
        setSelectedDeal(prevDeal);
      }
      onNotify(err instanceof Error ? err.message : 'Ошибка установки приоритета сделки', 'err');
    }
  };

  const handleReassignDealOwner = async (dealId: string, ownerId: string) => {
    if (!canWrite) {
      onNotify('Недостаточно прав RBAC (deals:write)', 'err');
      return;
    }
    const targetOwner = owners.find((o) => o.id === ownerId);
    if (!targetOwner) return;

    const prevDeal = deals.find((d) => d.id === dealId);
    if (!prevDeal || prevDeal.ownerId === ownerId) return;

    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? {
              ...d,
              ownerId: targetOwner.id,
              ownerName: targetOwner.fullName,
              ownerAvatar: targetOwner.avatarUrl,
            }
          : d
      )
    );
    if (selectedDeal?.id === dealId) {
      setEditOwnerId(targetOwner.id);
      setSelectedDeal((prev) =>
        prev
          ? {
              ...prev,
              ownerId: targetOwner.id,
              ownerName: targetOwner.fullName,
              ownerAvatar: targetOwner.avatarUrl,
            }
          : null
      );
    }

    try {
      await refineClient.request(`/api/crm/deals/${dealId}`, {
        method: 'PATCH',
        body: JSON.stringify({ ownerId }),
      });
      if (selectedDeal?.id === dealId) {
        void loadDealDetails(selectedDeal);
      }
      onNotify(`Ответственный назначен: ${targetOwner.fullName}`);
    } catch (err: unknown) {
      setDeals((prev) => prev.map((d) => (d.id === dealId ? prevDeal : d)));
      if (selectedDeal?.id === dealId) {
        setEditOwnerId(prevDeal.ownerId);
        setSelectedDeal(prevDeal);
      }
      onNotify(err instanceof Error ? err.message : 'Ошибка переназначения ответственного', 'err');
    }
  };

  const handleOpenDealContextMenu = useCallback((e: React.MouseEvent, deal: DealItem) => {
    e.preventDefault();
    e.stopPropagation();
    setFocusedDealId(deal.id);
    setContextMenu({
      dealId: deal.id,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await refineClient.create('crm/deals', {
        title: newTitle,
        budget: Number(newBudget) || 0,
        currency: 'RUB',
        pipelineId: selectedPipelineId || pipelines[0]?.id,
        stageId: newStageId || activeStages[0]?.id,
        contactId: newContactId || null,
        companyId: newCompanyId || null,
        tags: ['amoCRM'],
      });
      setShowNewModal(false);
      setNewTitle('');
      setNewContactId('');
      setNewCompanyId('');
      onNotify('Сделка создана');
      await fetchDeals();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка создания сделки', 'err');
    }
  };

  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await refineClient.request<{ pipeline: PipelineItem; stages: StageItem[] }>(
        '/api/crm/pipelines',
        {
          method: 'POST',
          body: JSON.stringify({ name: newPipelineName }),
        }
      );
      setPipelines((prev) => [...prev, res.pipeline]);
      setStages((prev) => [...prev, ...res.stages]);
      setSelectedPipelineId(res.pipeline.id);
      setShowNewPipelineModal(false);
      setNewPipelineName('');
      onNotify(`Воронка «${res.pipeline.name}» создана`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Не удалось создать воронку', 'err');
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    if (!canDelete) return;
    try {
      await refineClient.deleteOne('crm/deals', dealId);
      setSelectedDeal(null);
      setDeals((prev) => prev.filter((d) => d.id !== dealId));
      onNotify('Сделка удалена');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка удаления сделки', 'err');
    }
  };

  const handleAddTimelineNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeal || !noteBody.trim()) return;
    try {
      const res = await refineClient.request<{ harnessAnalysis?: DealHarnessAnalysis }>(
        `/api/crm/deals/${selectedDeal.id}/timeline`,
        {
          method: 'POST',
          body: JSON.stringify({ type: noteType, body: noteBody }),
        }
      );
      setNoteBody('');
      if (res.harnessAnalysis) {
        setDeals((prev) =>
          prev.map((d) => (d.id === selectedDeal.id ? { ...d, harnessAnalysis: res.harnessAnalysis! } : d))
        );
        setSelectedDeal((prev) =>
          prev ? { ...prev, harnessAnalysis: res.harnessAnalysis! } : null
        );
      }
      await loadDealDetails(selectedDeal);
      onNotify('Событие добавлено в таймлайн');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка добавления заметки', 'err');
    }
  };

  const handleCreateQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeal || !quickTaskTitle.trim() || !canCreateTask) return;
    try {
      const dueAt = quickTaskDue
        ? new Date(quickTaskDue).toISOString()
        : new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      await refineClient.create('crm/tasks', {
        title: quickTaskTitle.trim(),
        dealId: selectedDeal.id,
        taskType: quickTaskType,
        dueAt,
        durationMinutes: quickTaskType === 'meeting' ? 60 : 30,
      });
      setQuickTaskTitle('');
      onNotify(
        quickTaskType === 'meeting'
          ? 'Встреча запланирована и добавлена в календарь CRM'
          : 'Задача привязана к сделке'
      );
      await loadDealDetails(selectedDeal);
      await fetchDeals();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка создания задачи', 'err');
    }
  };

  const handleSendDealEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeal) return;
    setSendingEmail(true);
    try {
      const res = await refineClient.request<{ harnessAnalysis?: DealHarnessAnalysis }>(
        `/api/crm/deals/${selectedDeal.id}/send-email`,
        {
          method: 'POST',
          body: JSON.stringify({
            toEmail: emailTo,
            subject: emailSubject,
            body: emailBody,
            templateId: selectedTemplateId || null,
          }),
        }
      );
      if (res.harnessAnalysis) {
        setSelectedDeal((prev) =>
          prev ? { ...prev, harnessAnalysis: res.harnessAnalysis! } : null
        );
      }
      await loadDealDetails(selectedDeal);
      onNotify(`Письмо отправлено на ${emailTo}`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Не удалось отправить письмо', 'err');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCreateLinkedOfficeDoc = async (kind: 'xlsx' | 'docx' | 'pptx') => {
    if (!selectedDeal || !canWrite) return;
    setCreatingOfficeDocKind(kind);
    try {
      const label = kind === 'xlsx' ? 'Смета' : kind === 'docx' ? 'КП и SLA' : 'Презентация';
      const res = await refineClient.request<{ document: LinkedOfficeDoc }>('/api/office/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: `${label} — ${selectedDeal.title}`.slice(0, 120),
          kind,
          dealId: selectedDeal.id,
        }),
      });
      setDealDocs((prev) => [res.document, ...prev]);
      onNotify(`Создан ${kind.toUpperCase()} и сохранён в Garage S3`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка создания документа', 'err');
    } finally {
      setCreatingOfficeDocKind(null);
    }
  };

  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (selectedPipelineId && d.pipelineId !== selectedPipelineId) return false;
      if (ownerFilter !== 'all' && d.ownerId !== ownerFilter) return false;
      if (riskFilter !== 'all' && d.harnessAnalysis?.riskLevel !== riskFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        d.title.toLowerCase().includes(q) ||
        (d.contactName || '').toLowerCase().includes(q) ||
        (d.companyName || '').toLowerCase().includes(q)
      );
    });
  }, [deals, selectedPipelineId, ownerFilter, riskFilter, search]);

  const totalBudget = filteredDeals.reduce((sum, d) => sum + d.budget, 0);

  const buildReportContext = useCallback((): DealsReportContext => {
    const activePipeline = pipelines.find((p) => p.id === selectedPipelineId);
    const filterParts = [
      ownerFilter !== 'all'
        ? `Менеджер: ${owners.find((o) => o.id === ownerFilter)?.fullName || ownerFilter}`
        : null,
      riskFilter !== 'all' ? `Риск: ${riskFilter}` : null,
      search.trim() ? `Поиск: «${search.trim()}»` : null,
    ].filter(Boolean);
    return {
      pipelineName: activePipeline?.name || 'Все сделки',
      deals: filteredDeals,
      stages: activeStages.length > 0 ? activeStages : stages,
      filtersSummary: filterParts.length > 0 ? filterParts.join(' · ') : undefined,
      generatedBy: actor.fullName,
    };
  }, [
    pipelines,
    selectedPipelineId,
    ownerFilter,
    owners,
    riskFilter,
    search,
    filteredDeals,
    activeStages,
    stages,
    actor.fullName,
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Воронка сделок amoCRM"
        subtitle={`Сделок: ${filteredDeals.length} · Сумма: ${totalBudget.toLocaleString('ru-RU')} ₽`}
        actions={
          <>
            {pipelines.length > 0 && (
              <select
                aria-label="Выбор воронки"
                value={selectedPipelineId}
                onChange={(e) => setSelectedPipelineId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-[#0077FF]"
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {canWrite && (
              <button
                type="button"
                onClick={() => setShowNewPipelineModal(true)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                + Воронка
              </button>
            )}

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  ['kanban', 'Канбан', Kanban],
                  ['list', 'Список', LayoutList],
                  ['gantt', 'Гант', Sparkles],
                  ['analytics', 'Конверсии', BarChart3],
                ] as const
              ).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                    viewMode === mode ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {canHarness && (
              <button
                type="button"
                disabled={analyzingAll}
                onClick={() => void handleAnalyzeAllDeals()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-[#0077FF] hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
              >
                <Cpu className="h-3.5 w-3.5" />
                {analyzingAll ? 'Анализ...' : 'AI-скоринг'}
              </button>
            )}

            <CrmExportMenu
              label="Экспорт"
              filePrefix="crm-deals"
              buildUrl={(format) => {
                const params = new URLSearchParams({ format });
                if (selectedPipelineId) params.set('pipelineId', selectedPipelineId);
                if (ownerFilter !== 'all') params.set('ownerId', ownerFilter);
                if (riskFilter !== 'all') params.set('riskLevel', riskFilter);
                if (search.trim()) params.set('q', search.trim());
                return `/api/crm/deals/export?${params.toString()}`;
              }}
              onClientExportPdf={() => exportDealsToPdf(buildReportContext())}
              onClientExportXlsx={() => exportDealsToXlsx(buildReportContext())}
              onNotify={onNotify}
            />

            {canWrite && (
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                title="Импортировать сделки из CSV или Excel (.xlsx)"
              >
                <Upload className="h-3.5 w-3.5 text-slate-500" />
                Импорт
              </button>
            )}

            {canWrite && (
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Новая сделка
              </button>
            )}
          </>
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
        <VoiceSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Поиск по сделке, контакту или компании..."
          ariaLabel="Поиск сделок"
          voiceHint="Назовите сделку, контакт или компанию"
          onNotify={onNotify}
          className="min-w-[220px]"
        />

        <select
          aria-label="Фильтр по ответственному"
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0077FF]"
        >
          <option value="all">Все менеджеры</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.fullName}
            </option>
          ))}
        </select>

        <select
          aria-label="Фильтр по риску"
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value as typeof riskFilter)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0077FF]"
        >
          <option value="all">Любой риск Harness</option>
          <option value="Высокий">Высокий риск</option>
          <option value="Средний">Средний риск</option>
          <option value="Низкий">Низкий риск</option>
        </select>
      </div>

      {/* Kanban / List / Gantt */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white p-3" />
          ))}
        </div>
      ) : filteredDeals.length === 0 && viewMode !== 'kanban' ? (
        <EmptyState
          title="Сделки по фильтру не найдены"
          description="Измените параметры поиска или создайте новую сделку в текущей воронке."
          action={
            canWrite ? (
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white"
              >
                Создать сделку
              </button>
            ) : undefined
          }
        />
      ) : viewMode === 'kanban' ? (
        <div className="flex gap-3.5 overflow-x-auto pb-4">
          {activeStages.map((stage) => {
            const stageDeals = filteredDeals.filter((d) => d.stageId === stage.id);
            const stageSum = stageDeals.reduce((s, d) => s + d.budget, 0);

            return (
              <div
                key={stage.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedDealId) {
                    void handleMoveStage(draggedDealId, stage.id);
                    setDraggedDealId(null);
                  }
                }}
                className="flex min-w-[270px] flex-1 flex-col rounded-xl border border-slate-200 bg-[#F8FAFC]"
              >
                <div
                  className="border-t-4 border-b border-slate-200 bg-white px-3.5 py-2.5 rounded-t-xl"
                  style={{ borderTopColor: stage.color }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-slate-900">{stage.name}</span>
                    <span className="text-xs font-semibold text-slate-500 tabular-nums">
                      {stageDeals.length}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
                    {stageSum.toLocaleString('ru-RU')} ₽
                  </div>
                </div>

                <div className="flex-1 space-y-2.5 p-2.5">
                  {stageDeals.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-[11px] text-slate-400">
                      Перетащите сделку сюда
                    </div>
                  ) : (
                    stageDeals.map((deal) => {
                      const dealScore = computeDealScore(deal, stage);
                      return (
                        <DealCard
                          key={deal.id}
                          title={deal.title}
                          budget={deal.budget}
                          currency={deal.currency}
                          companyName={deal.companyName}
                          contactName={deal.contactName}
                          ownerName={deal.ownerName}
                          openTasksCount={deal.openTasksCount}
                          hasOverdueTask={deal.hasOverdueTask}
                          tags={deal.tags}
                          priority={deal.customFields?.priority}
                          dealScore={{
                            score: dealScore.score,
                            label: dealScore.label,
                            textClass: dealScore.textClass,
                          }}
                          selected={selectedDeal?.id === deal.id || focusedDealId === deal.id}
                          harnessAnalysis={deal.harnessAnalysis}
                          draggable={canWrite}
                          onDragStart={() => {
                            setFocusedDealId(deal.id);
                            setDraggedDealId(deal.id);
                          }}
                          onClick={() => openDealDrawer(deal)}
                          onContextMenu={(e) => handleOpenDealContextMenu(e, deal)}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'gantt' ? (
        <DealsGanttView
          deals={filteredDeals}
          stages={activeStages}
          getDealAnalysis={(d) => d.harnessAnalysis || null}
          onOpenDeal={openDealDrawer}
          onDealContextMenu={handleOpenDealContextMenu}
        />
      ) : viewMode === 'analytics' ? (
        <Suspense
          fallback={
            <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-slate-200 bg-white text-xs text-slate-500">
              Загрузка аналитики Recharts...
            </div>
          }
        >
          <DealsAnalyticsView
            deals={filteredDeals}
            stages={activeStages}
            onSwitchToKanban={() => setViewMode('kanban')}
          />
        </Suspense>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
              <tr>
                <th className="px-4 py-3">Название сделки</th>
                <th className="px-4 py-3">Этап</th>
                <th className="px-4 py-3">Контакт / Компания</th>
                <th className="px-4 py-3">Следующий шаг (Harness)</th>
                <th className="px-4 py-3 text-right">Бюджет</th>
                <th className="px-4 py-3">Менеджер</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDeals.map((deal) => {
                const st = activeStages.find((s) => s.id === deal.stageId);
                return (
                  <tr
                    key={deal.id}
                    onClick={() => openDealDrawer(deal)}
                    onContextMenu={(e) => handleOpenDealContextMenu(e, deal)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{deal.title}</div>
                      {deal.customFields?.priority && (
                        <div
                          className={`mt-0.5 text-[11px] font-medium ${
                            deal.customFields.priority === 'Высокий'
                              ? 'text-red-600'
                              : deal.customFields.priority === 'Средний'
                              ? 'text-amber-600'
                              : 'text-slate-500'
                          }`}
                        >
                          Приоритет: {deal.customFields.priority}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: st?.color || '#64748B' }}
                        />
                        {st?.name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {[deal.contactName, deal.companyName].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {deal.harnessAnalysis ? (
                        <div className="max-w-xs truncate">
                          <span className="font-semibold text-[#0077FF] tabular-nums">
                            {deal.harnessAnalysis.winProbability}%
                          </span>{' '}
                          · {deal.harnessAnalysis.nextStep.title}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">
                      {deal.budget.toLocaleString('ru-RU')} {deal.currency}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{deal.ownerName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Deal Inspector Drawer */}
      {selectedDeal && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
              <div className="min-w-0 pr-4">
                <div className="text-[11px] font-medium text-slate-500">
                  Карточка сделки amoCRM · {selectedDeal.id}
                </div>
                <h2 className="mt-0.5 truncate text-lg font-semibold text-slate-900">
                  {selectedDeal.title}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteDeal(selectedDeal.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Удалить сделку"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDeal(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {/* Stage Selector Bar */}
              <div>
                <div className="mb-1.5 text-xs font-semibold text-slate-700">Этап воронки</div>
                <div className="flex flex-wrap gap-1.5">
                  {activeStages.map((st) => {
                    const active = selectedDeal.stageId === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        disabled={!canWrite}
                        onClick={() => void handleMoveStage(selectedDeal.id, st.id)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {st.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority, Auto-Assignment, Score & Contract PDF Strip */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                {(() => {
                  const activeStageObj = activeStages.find((s) => s.id === selectedDeal.stageId) || null;
                  const scoreInfo = computeDealScore(selectedDeal, activeStageObj);
                  return (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-slate-900">
                            Приоритет и скоринг сделки
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
                            Скоринг:{' '}
                            <span className={`font-semibold ${scoreInfo.textClass}`}>
                              {scoreInfo.score}/100 ({scoreInfo.label})
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(['Высокий', 'Средний', 'Низкий'] as const).map((level) => {
                            const active = selectedDeal.customFields?.priority === level;
                            return (
                              <button
                                key={level}
                                type="button"
                                disabled={!canWrite}
                                onClick={() => void handleSetDealPriority(selectedDeal.id, level)}
                                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                                  active
                                    ? 'border-[#0077FF] bg-[#0077FF] text-white'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {level}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500 tabular-nums">
                        {scoreInfo.factors.map((f) => (
                          <span key={f.label}>
                            {f.label}:{' '}
                            <span className={f.delta >= 0 ? 'font-medium text-emerald-700' : 'font-medium text-red-600'}>
                              {f.delta >= 0 ? `+${f.delta}` : f.delta}
                            </span>
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => void handleAutoAssignDeal(selectedDeal.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap"
                          >
                            <UserCheck className="h-3.5 w-3.5 text-[#0077FF]" />
                            Авто-назначить менеджера
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleExportSingleDealPdf(selectedDeal, 'proposal')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <Download className="h-3.5 w-3.5" />
                          КП PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleExportSingleDealPdf(selectedDeal, 'contract')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Договор PDF
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Editable Core Attributes */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">Параметры сделки</span>
                  {canWrite && (
                    <button
                      type="button"
                      disabled={savingDealFields}
                      onClick={() => void handleSaveDealFields()}
                      className="rounded-lg bg-[#0077FF] px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingDealFields ? 'Сохранение...' : 'Сохранить поля'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-medium text-slate-500">Название сделки</label>
                    <input
                      type="text"
                      disabled={!canWrite}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-[#0077FF]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Бюджет (₽)</label>
                    <input
                      type="number"
                      min={0}
                      disabled={!canWrite}
                      value={editBudget}
                      onChange={(e) => setEditBudget(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs tabular-nums outline-none focus:border-[#0077FF]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Ответственный</label>
                    <select
                      disabled={!canWrite}
                      value={editOwnerId}
                      onChange={(e) => setEditOwnerId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#0077FF]"
                    >
                      {owners.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Контакт</label>
                    <select
                      disabled={!canWrite}
                      value={editContactId}
                      onChange={(e) => setEditContactId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#0077FF]"
                    >
                      <option value="">Без контакта</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName} {c.companyName ? `(${c.companyName})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Компания</label>
                    <select
                      disabled={!canWrite}
                      value={editCompanyId}
                      onChange={(e) => setEditCompanyId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#0077FF]"
                    >
                      <option value="">Без компании</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Unified AI Copilot (DeepSeek-Harness + Dify) */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                    <Sparkles className="h-4 w-4 text-[#0077FF]" />
                    AI Copilot сделки (DeepSeek-Harness &amp; Dify)
                  </div>
                  {canHarness && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={analyzingDealId === selectedDeal.id}
                        onClick={() => void handleAnalyzeDeal(selectedDeal.id)}
                        className="rounded-lg bg-[#0077FF] px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {analyzingDealId === selectedDeal.id ? 'Расчёт...' : 'Пересчитать'}
                      </button>
                      <button
                        type="button"
                        disabled={draftingEmail}
                        onClick={() => void handleGenerateDifyEmailDraft(selectedDeal)}
                        className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-[#0077FF] hover:bg-blue-50 disabled:opacity-50"
                      >
                        {draftingEmail ? 'Генерация...' : 'Черновик письма (Dify)'}
                      </button>
                    </div>
                  )}
                </div>

                {selectedDeal.harnessAnalysis ? (
                  <div className="mt-3 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-semibold text-slate-900 tabular-nums">
                        Вероятность: {selectedDeal.harnessAnalysis.winProbability}%
                      </span>
                      <span className="text-slate-300">·</span>
                      <span
                        className={`font-medium ${
                          selectedDeal.harnessAnalysis.riskLevel === 'Высокий'
                            ? 'text-red-600'
                            : selectedDeal.harnessAnalysis.riskLevel === 'Средний'
                            ? 'text-amber-600'
                            : 'text-emerald-700'
                        }`}
                      >
                        Риск: {selectedDeal.harnessAnalysis.riskLevel}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {selectedDeal.harnessAnalysis.contactHistorySummary}
                    </div>
                    <div className="rounded-lg border border-blue-100 bg-white p-3">
                      <div className="text-[11px] font-medium text-[#0077FF]">
                        Рекомендованный следующий шаг
                      </div>
                      <div className="mt-0.5 text-xs font-semibold text-slate-900">
                        {selectedDeal.harnessAnalysis.nextStep.title}
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {selectedDeal.harnessAnalysis.nextStep.rationale}
                      </p>
                      {canCreateTask && (
                        <button
                          type="button"
                          disabled={applyingNextStep}
                          onClick={() => void handleApplyNextStep(selectedDeal.id)}
                          className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {applyingNextStep ? 'Создание...' : 'Создать задачу из рекомендации'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-slate-500">
                    Нажмите «Пересчитать» для запуска анализа истории контактов.
                  </div>
                )}
              </div>

              {/* Quick Meeting / Task Add (synced with CRM Calendar & Tasks) */}
              {canCreateTask && (
                <form onSubmit={handleCreateQuickTask} className="flex flex-wrap gap-2">
                  <select
                    aria-label="Тип активности по сделке"
                    value={quickTaskType}
                    onChange={(e) =>
                      setQuickTaskType(e.target.value as 'meeting' | 'followup' | 'call')
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-[#0077FF]"
                  >
                    <option value="meeting">Встреча</option>
                    <option value="call">Звонок</option>
                    <option value="followup">Задача</option>
                  </select>
                  <input
                    type="text"
                    value={quickTaskTitle}
                    onChange={(e) => setQuickTaskTitle(e.target.value)}
                    placeholder={
                      quickTaskType === 'meeting'
                        ? 'Встреча по сделке (появится в календаре)...'
                        : 'Задача по сделке...'
                    }
                    className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-[#0077FF]"
                  />
                  <input
                    type="datetime-local"
                    aria-label="Дата и время события"
                    value={quickTaskDue}
                    onChange={(e) => setQuickTaskDue(e.target.value)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs tabular-nums outline-none focus:border-[#0077FF]"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                  >
                    {quickTaskType === 'meeting' ? '+ Встреча' : '+ Задача'}
                  </button>
                </form>
              )}

              {/* Univer Office Documents */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900">
                    Документы Univer + Garage S3 + Forgejo
                  </span>
                  {canWrite && (
                    <div className="flex items-center gap-1.5">
                      {(
                        [
                          ['xlsx', 'Смета .xlsx', FileSpreadsheet],
                          ['docx', 'КП .docx', FileText],
                          ['pptx', 'Презентация .pptx', Presentation],
                        ] as const
                      ).map(([kind, label, Icon]) => (
                        <button
                          key={kind}
                          type="button"
                          disabled={creatingOfficeDocKind !== null}
                          onClick={() => void handleCreateLinkedOfficeDoc(kind)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-[#0077FF] hover:text-[#0077FF]"
                        >
                          <Icon className="h-3 w-3" />
                          {creatingOfficeDocKind === kind ? '...' : label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {dealDocs.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">Документы ещё не прикреплены.</p>
                ) : (
                  <div className="mt-2.5 space-y-1.5">
                    {dealDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">{doc.title}</div>
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            {doc.kind.toUpperCase()} · {Math.max(1, Math.round(doc.sizeBytes / 1024))} КБ
                            {doc.latestCommitSha ? ` · git ${doc.latestCommitSha.slice(0, 7)}` : ''}
                          </div>
                        </div>
                        {onOpenOfficeDoc && (
                          <button
                            type="button"
                            onClick={() => onOpenOfficeDoc(doc.id)}
                            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#0077FF] hover:underline"
                          >
                            Открыть <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Email Composer */}
              {canWrite && (
                <form onSubmit={handleSendDealEmail} className="space-y-2.5 rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                      <Mail className="h-3.5 w-3.5 text-[#0077FF]" />
                      Отправить письмо клиенту
                    </span>
                    <button
                      type="button"
                      onClick={() => setTemplatesModalOpen(true)}
                      className="text-xs font-medium text-[#0077FF] hover:underline"
                    >
                      Шаблоны ({emailTemplates.length})
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select
                      aria-label="Выбрать шаблон письма"
                      value={selectedTemplateId}
                      onChange={(e) => {
                        const found = emailTemplates.find((t) => t.id === e.target.value);
                        if (found) applyTemplateObjectToDeal(found, selectedDeal);
                      }}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#0077FF]"
                    >
                      <option value="">Без шаблона</option>
                      {emailTemplates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="email"
                      required
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="Email получателя"
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#0077FF]"
                    />
                  </div>

                  <input
                    type="text"
                    required
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Тема письма"
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#0077FF]"
                  />
                  <textarea
                    rows={3}
                    required
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="Текст письма..."
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-xs outline-none focus:border-[#0077FF]"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={sendingEmail}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {sendingEmail ? 'Отправка...' : 'Отправить письмо'}
                    </button>
                  </div>
                </form>
              )}

              {/* Timeline Note Form & History */}
              <div>
                <h4 className="mb-2 text-xs font-semibold text-slate-900">Таймлайн событий</h4>
                {canWrite && (
                  <form onSubmit={handleAddTimelineNote} className="mb-3 flex gap-2">
                    <select
                      aria-label="Тип записи таймлайна"
                      value={noteType}
                      onChange={(e) => setNoteType(e.target.value as 'note' | 'call' | 'email')}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none"
                    >
                      <option value="note">Заметка</option>
                      <option value="call">Звонок</option>
                      <option value="email">Письмо</option>
                    </select>
                    <input
                      type="text"
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                      placeholder="Добавить комментарий в карточку сделки..."
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-[#0077FF]"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Добавить
                    </button>
                  </form>
                )}

                <div className="space-y-2">
                  {timeline.length === 0 ? (
                    <div className="text-xs text-slate-400">История касаний пуста</div>
                  ) : (
                    timeline.map((ev) => (
                      <div key={ev.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-medium text-slate-700">
                            {ev.authorName} · {ev.type}
                          </span>
                          <span className="tabular-nums">
                            {new Date(ev.createdAt).toLocaleString('ru-RU')}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-line text-slate-700">{ev.body}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Deal Modal */}
      <Modal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Новая сделка amoCRM"
        subtitle="Сразу запускает оценку вероятности в DeepSeek-Harness"
      >
        <form onSubmit={handleCreateDeal} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Название сделки *</label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Например: ЛогистикПро — Внедрение CRM"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Бюджет (₽)</label>
              <input
                type="number"
                min={0}
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-[#0077FF]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Этап воронки</label>
              <select
                value={newStageId}
                onChange={(e) => setNewStageId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
              >
                {activeStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Контакт</label>
              <select
                value={newContactId}
                onChange={(e) => setNewContactId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              >
                <option value="">Без контакта</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Компания</label>
              <select
                value={newCompanyId}
                onChange={(e) => setNewCompanyId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0077FF]"
              >
                <option value="">Без компании</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowNewModal(false)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Создать сделку
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Pipeline Modal */}
      <Modal
        open={showNewPipelineModal}
        onClose={() => setShowNewPipelineModal(false)}
        title="Новая воронка продаж"
        subtitle="Автоматически создаст 5 стандартных этапов"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleCreatePipeline} className="space-y-4">
          <input
            type="text"
            required
            value={newPipelineName}
            onChange={(e) => setNewPipelineName(e.target.value)}
            placeholder="Например: Партнёрские интеграции"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewPipelineModal(false)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Создать воронку
            </button>
          </div>
        </form>
      </Modal>

      {/* Shared Email Templates Picker Modal */}
      <EmailTemplatesModal
        open={templatesModalOpen}
        templates={emailTemplates}
        initialTemplateId={selectedTemplateId || undefined}
        canWrite={canWrite}
        previewContext={selectedDeal ? buildDealEmailContext(selectedDeal, stages) : undefined}
        onClose={() => setTemplatesModalOpen(false)}
        onTemplatesChange={setEmailTemplates}
        onApplyToDeal={(tpl) => {
          if (selectedDeal) applyTemplateObjectToDeal(tpl, selectedDeal);
        }}
        onNotify={onNotify}
      />

      {/* CSV / Excel Deals Import Modal */}
      <CrmImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        mode="deals"
        pipelineId={selectedPipelineId}
        pipelineName={pipelines.find((p) => p.id === selectedPipelineId)?.name}
        onImported={async () => {
          await fetchDeals();
        }}
        onNotify={onNotify}
      />

      {/* Right-Click Deal Context Menu */}
      {(() => {
        const ctxDeal = contextMenu ? deals.find((d) => d.id === contextMenu.dealId) : null;
        if (!contextMenu || !ctxDeal) return null;
        const canEditCtxDeal =
          canWrite && !(actor.dataScope === 'own' && ctxDeal.ownerId !== actor.userId);
        return (
          <DealContextMenu
            deal={ctxDeal}
            position={{ x: contextMenu.x, y: contextMenu.y }}
            stages={stages}
            owners={owners}
            canEdit={canEditCtxDeal}
            onSelectStage={handleMoveStage}
            onSelectOwner={handleReassignDealOwner}
            onSelectPriority={handleSetDealPriority}
            onOpenDeal={openDealDrawer}
            onClose={() => setContextMenu(null)}
          />
        );
      })()}
    </div>
  );
};
