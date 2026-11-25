import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  FolderGit2,
  GitCommitHorizontal,
  HardDrive,
  Plus,
  Presentation,
  Save,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  GarageBucketSummary,
  GarageClusterInfo,
  GarageObjectSummary,
} from '../../application/office/garageS3Client.ts';
import { refineClient } from '../../application/refine/client.ts';
import { useVoiceSectionAction } from '../../application/voice/voiceActionBus.ts';
import type { OfficeDocKind, UniverContent } from '../../domain/office/entities.ts';
import type { AuthenticatedActor, TenantContext } from '../../domain/shared/types.ts';
import { GarageFileManager } from '../components/GarageFileManager.tsx';
import { UniverEditorCanvas } from '../components/UniverEditorCanvas.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';
import type { DealItem } from '../types.ts';

export interface OfficeDocumentRow {
  id: string;
  tenantId: string;
  title: string;
  kind: OfficeDocKind;
  dealId: string | null;
  bucketName: string;
  objectKey: string;
  forgejoRepoId: string | null;
  latestCommitSha: string | null;
  sizeBytes: number;
  content: UniverContent;
  updatedBy: string;
  updatedAt: string;
}

interface ForgejoRepoRow {
  id: string;
  ownerSlug: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  cloneUrl: string;
  visibility: string;
  lfsBucket: string;
  description: string;
}

interface ForgejoCommitRow {
  id: string;
  repoId: string;
  branch: string;
  commitSha: string;
  message: string;
  authorName: string;
  s3ObjectKey: string | null;
  createdAt: string;
}

interface OfficeWorkspaceResponse {
  garage: {
    cluster: GarageClusterInfo;
    buckets: GarageBucketSummary[];
    objects: GarageObjectSummary[];
  };
  forgejo: {
    server: { baseUrl: string; lfsStorage: string; externalSyncEnabled: boolean };
    repos: ForgejoRepoRow[];
    commits: ForgejoCommitRow[];
  };
  documents: OfficeDocumentRow[];
}

interface OfficeDocumentsViewProps {
  actor: AuthenticatedActor;
  tenant: TenantContext;
  initialDocumentId?: string | null;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

type OfficeSubTab = 'univer' | 'garage' | 'forgejo';

export const OfficeDocumentsView: React.FC<OfficeDocumentsViewProps> = ({
  actor,
  tenant,
  initialDocumentId,
  onNotify,
}) => {
  const [subTab, setSubTab] = useState<OfficeSubTab>('univer');
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<OfficeWorkspaceResponse | null>(null);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(initialDocumentId || null);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftDealId, setDraftDealId] = useState('');
  const [draftRepoId, setDraftRepoId] = useState('');
  const [draftContent, setDraftContent] = useState<UniverContent | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | OfficeDocKind>('all');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<OfficeDocKind>('xlsx');
  const [newDealId, setNewDealId] = useState('');

  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const canWrite = refineClient.can(actor, 'deals:write');

  useVoiceSectionAction('office', (actionId) => {
    switch (actionId) {
      case 'office.create_document':
        if (!canWrite) return false;
        setShowCreateModal(true);
        return true;
      case 'office.tab_univer':
        setSubTab('univer');
        return true;
      case 'office.tab_garage':
        setSubTab('garage');
        return true;
      case 'office.tab_forgejo':
        setSubTab('forgejo');
        return true;
      case 'office.refresh':
        void loadWorkspace(selectedDocId);
        return true;
      default:
        return false;
    }
  });

  const applySelectedDoc = useCallback(
    (doc: OfficeDocumentRow | undefined, repos: ForgejoRepoRow[]) => {
      if (!doc) {
        setDraftContent(null);
        return;
      }
      setSelectedDocId(doc.id);
      setDraftTitle(doc.title);
      setDraftDealId(doc.dealId || '');
      setDraftRepoId(doc.forgejoRepoId || repos[0]?.id || '');
      setDraftContent(doc.content);
    },
    []
  );

  const loadWorkspace = useCallback(
    async (selectIdAfter?: string | null) => {
      try {
        const [res, dealsRes] = await Promise.all([
          refineClient.request<OfficeWorkspaceResponse>('/api/office/workspace'),
          refineClient.can(actor, 'deals:read')
            ? refineClient.request<{ deals: DealItem[] }>('/api/crm/deals')
            : Promise.resolve({ deals: [] }),
        ]);
        setWorkspace(res);
        setDeals(dealsRes.deals || []);
        const targetId =
          selectIdAfter ||
          initialDocumentId ||
          res.documents[0]?.id ||
          null;
        const active = res.documents.find((d) => d.id === targetId) || res.documents[0];
        applySelectedDoc(active, res.forgejo.repos);
      } catch (err: unknown) {
        onNotify(err instanceof Error ? err.message : 'Ошибка загрузки контура документов', 'err');
      } finally {
        setLoading(false);
      }
    },
    [actor, initialDocumentId, applySelectedDoc, onNotify]
  );

  useEffect(() => {
    setLoading(true);
    void loadWorkspace(initialDocumentId);
  }, [tenant.id, actor.userId, initialDocumentId, loadWorkspace]);

  const selectDocument = (doc: OfficeDocumentRow) => {
    applySelectedDoc(doc, workspace?.forgejo.repos || []);
    setCommitMessage('');
  };

  const filteredDocs = useMemo(() => {
    const list = workspace?.documents || [];
    const q = searchQuery.trim().toLowerCase();
    return list.filter((d) => {
      if (kindFilter !== 'all' && d.kind !== kindFilter) return false;
      if (!q) return true;
      return d.title.toLowerCase().includes(q) || d.objectKey.toLowerCase().includes(q);
    });
  }, [workspace, searchQuery, kindFilter]);

  const activeDoc = useMemo(
    () => workspace?.documents.find((d) => d.id === selectedDocId) || null,
    [workspace, selectedDocId]
  );

  const handleSaveDocument = async (withCommit: boolean) => {
    if (!activeDoc || !draftContent) return;
    setSaving(true);
    try {
      const res = await refineClient.request<{ document: OfficeDocumentRow }>(
        `/api/office/documents/${activeDoc.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            title: draftTitle.trim() || activeDoc.title,
            dealId: draftDealId || null,
            forgejoRepoId: draftRepoId || null,
            content: draftContent,
            ...(withCommit
              ? {
                  commitMessage:
                    commitMessage.trim() ||
                    `docs(${activeDoc.kind}): update ${draftTitle.trim() || activeDoc.title}`,
                }
              : {}),
          }),
        }
      );
      setCommitMessage('');
      await loadWorkspace(res.document.id);
      onNotify(
        withCommit
          ? 'Сохранено в Garage S3 и зафиксировано коммитом в Forgejo'
          : 'Документ Univer сохранён в Garage S3'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка сохранения документа', 'err');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const res = await refineClient.request<{ document: OfficeDocumentRow }>('/api/office/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          kind: newKind,
          dealId: newDealId || null,
        }),
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDealId('');
      await loadWorkspace(res.document.id);
      onNotify(`Создан документ «${res.document.title}» (.${res.document.kind}) в Garage S3`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка создания документа', 'err');
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Ошибка чтения файла'));
        reader.readAsDataURL(file);
      });

      const res = await refineClient.request<{ document: OfficeDocumentRow }>('/api/office/documents/upload', {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          base64Content: base64,
        }),
      });
      await loadWorkspace(res.document.id);
      onNotify(`Файл ${file.name} загружен в Garage S3 и открыт в Univer`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка импорта файла', 'err');
    }
  };

  const handleDownloadBinary = async (urlPath: string, fallbackName: string) => {
    try {
      await refineClient.downloadBlob(urlPath, fallbackName);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка скачивания файла', 'err');
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await refineClient.deleteOne('office/documents', id);
      await loadWorkspace(null);
      onNotify('Документ и объект Garage S3 удалены');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка удаления документа', 'err');
    }
  };

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim()) return;
    try {
      await refineClient.create('office/forgejo/repos', {
        name: newRepoName.trim().toLowerCase(),
        description: newRepoDesc.trim(),
      });
      setNewRepoName('');
      setNewRepoDesc('');
      await loadWorkspace();
      onNotify('Репозиторий Forgejo создан');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка создания репозитория Forgejo', 'err');
    }
  };

  const kindIcon = (kind: OfficeDocKind) => {
    if (kind === 'xlsx') return <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />;
    if (kind === 'docx') return <FileText className="h-4 w-4 shrink-0 text-[#0077FF]" />;
    return <Presentation className="h-4 w-4 shrink-0 text-amber-600" />;
  };

  if (loading || !workspace) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Инициализация Forgejo, Garage S3 и Univer Office...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Документы Univer, Garage S3 и Forgejo"
        subtitle={`${workspace.documents.length} документов · ${workspace.garage.buckets.length} бакетов Garage S3 · ${workspace.forgejo.repos.length} репо Forgejo`}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setSubTab('univer')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  subTab === 'univer'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#0077FF]" />
                Univer Офис
              </button>
              <button
                type="button"
                onClick={() => setSubTab('garage')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  subTab === 'garage'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HardDrive className="h-3.5 w-3.5 text-emerald-600" />
                Garage S3
              </button>
              <button
                type="button"
                onClick={() => setSubTab('forgejo')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  subTab === 'forgejo'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderGit2 className="h-3.5 w-3.5 text-amber-600" />
                Forgejo Git
              </button>
            </div>

            <input
              ref={uploadInputRef}
              type="file"
              accept=".xlsx,.docx,.pptx"
              onChange={handleUploadFile}
              className="hidden"
            />
            {canWrite && (
              <>
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <Upload className="h-3.5 w-3.5 text-slate-600" />
                  Импорт OOXML
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Новый документ
                </button>
              </>
            )}
          </>
        }
      />

      {/* TAB 1: UNIVER OFFICE SUITE */}
      {subTab === 'univer' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white lg:col-span-3">
            <div className="space-y-2 border-b border-slate-200 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск документа..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs outline-none focus:border-[#0077FF] focus:bg-white"
                />
              </div>
              <div className="grid grid-cols-4 gap-1 text-[11px]">
                {(['all', 'xlsx', 'docx', 'pptx'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKindFilter(k)}
                    className={`rounded-md py-1 font-medium uppercase whitespace-nowrap ${
                      kindFilter === k
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {k === 'all' ? 'Все' : k}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[600px] flex-1 space-y-1.5 overflow-y-auto p-2.5">
              {filteredDocs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">Нет документов</div>
              ) : (
                filteredDocs.map((doc) => {
                  const selected = doc.id === selectedDocId;
                  const linkedDeal = deals.find((d) => d.id === doc.dealId);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => selectDocument(doc)}
                      className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                        selected
                          ? 'border-[#0077FF] bg-blue-50/70'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {kindIcon(doc.kind)}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-slate-900">{doc.title}</div>
                          <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                            <span className="font-mono uppercase">{doc.kind}</span>
                            <span>{(doc.sizeBytes / 1024).toFixed(1)} КБ</span>
                          </div>
                          {linkedDeal && (
                            <div className="mt-1 truncate text-[10px] font-medium text-blue-700">
                              Сделка: {linkedDeal.title}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-3 lg:col-span-9">
            {activeDoc && draftContent ? (
              <>
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-[240px] flex-1 items-center gap-2">
                      {kindIcon(activeDoc.kind)}
                      <input
                        type="text"
                        disabled={!canWrite}
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-[#0077FF]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleDownloadBinary(
                            `/api/office/documents/${activeDoc.id}/download`,
                            `${draftTitle || activeDoc.title}.${activeDoc.kind}`
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Скачать .{activeDoc.kind}
                      </button>

                      {canWrite && (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleSaveDocument(false)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                          >
                            <Save className="h-3.5 w-3.5 text-emerald-600" />
                            {saving ? 'Сохранение...' : 'В Garage S3'}
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleSaveDocument(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            <GitCommitHorizontal className="h-3.5 w-3.5" />
                            Сохранить + Commit в Forgejo
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteDocument(activeDoc.id)}
                            className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                            title="Удалить документ"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-3">
                    <div>
                      <label className="block text-[11px] text-slate-500">Привязка к сделке CRM</label>
                      <select
                        disabled={!canWrite}
                        value={draftDealId}
                        onChange={(e) => setDraftDealId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 outline-none"
                      >
                        <option value="">— Без привязки к сделке —</option>
                        {deals.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-500">Репозиторий Forgejo</label>
                      <select
                        disabled={!canWrite}
                        value={draftRepoId}
                        onChange={(e) => setDraftRepoId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 outline-none"
                      >
                        {workspace.forgejo.repos.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.fullName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-500">Сообщение коммита Forgejo</label>
                      <input
                        type="text"
                        disabled={!canWrite}
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        placeholder={`docs(${activeDoc.kind}): обновить ревизию`}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] text-slate-500">
                    <span>
                      S3: s3://{activeDoc.bucketName}/{activeDoc.objectKey}
                    </span>
                    {activeDoc.latestCommitSha && <span>Forgejo HEAD: {activeDoc.latestCommitSha}</span>}
                  </div>
                </div>

                <UniverEditorCanvas
                  content={draftContent}
                  canWrite={canWrite}
                  docTitle={draftTitle || activeDoc.title}
                  onChange={setDraftContent}
                />
              </>
            ) : (
              <EmptyState
                title="Выберите или создайте документ"
                description="Документы Univer (.xlsx, .docx, .pptx) сохраняются в Garage S3 и версионируются в Forgejo."
                action={
                  canWrite ? (
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> Новый документ
                    </button>
                  ) : undefined
                }
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GARAGE S3 FILE MANAGER */}
      {subTab === 'garage' && (
        <GarageFileManager
          tenantSubdomain={tenant.subdomain}
          cluster={workspace.garage.cluster}
          buckets={workspace.garage.buckets}
          allObjects={workspace.garage.objects}
          canWrite={canWrite}
          onRefreshWorkspace={() => loadWorkspace(selectedDocId)}
          onOpenUniverDocument={(docId) => {
            const target = workspace.documents.find((d) => d.id === docId);
            if (target) {
              selectDocument(target);
              setSubTab('univer');
            }
          }}
          onNotify={onNotify}
        />
      )}

      {/* TAB 3: FORGEJO GIT & LFS */}
      {subTab === 'forgejo' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderGit2 className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-slate-900">Репозитории Forgejo</h2>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                {workspace.forgejo.server.baseUrl}
              </span>
            </div>

            <div className="space-y-2.5">
              {workspace.forgejo.repos.map((repo) => (
                <div key={repo.id} className="space-y-1.5 rounded-lg border border-slate-200 p-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-slate-900">{repo.fullName}</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {repo.defaultBranch} · {repo.visibility}
                    </span>
                  </div>
                  {repo.description && <p className="leading-relaxed text-slate-600">{repo.description}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-[11px] text-slate-400">
                    <span>LFS: {repo.lfsBucket}</span>
                    <span>{repo.cloneUrl}</span>
                  </div>
                </div>
              ))}
            </div>

            {canWrite && (
              <form onSubmit={handleCreateRepo} className="space-y-2.5 border-t border-slate-100 pt-3">
                <label className="block text-xs font-medium text-slate-700">
                  Новый репозиторий Forgejo (с привязкой к Garage LFS)
                </label>
                <input
                  type="text"
                  required
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  placeholder="legal-contracts"
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-[#0077FF]"
                />
                <input
                  type="text"
                  value={newRepoDesc}
                  onChange={(e) => setNewRepoDesc(e.target.value)}
                  placeholder="Описание репозитория..."
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#0077FF]"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Создать репозиторий в Forgejo
                </button>
              </form>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
            <h2 className="text-sm font-semibold text-slate-900">
              История коммитов Forgejo ({workspace.forgejo.commits.length})
            </h2>
            <div className="mt-3 max-h-[520px] space-y-2.5 overflow-y-auto pr-1">
              {workspace.forgejo.commits.map((c) => {
                const repo = workspace.forgejo.repos.find((r) => r.id === c.repoId);
                return (
                  <div key={c.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{c.message}</span>
                      <span className="font-mono text-[11px] font-semibold text-[#0077FF]">
                        {c.commitSha}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span>
                        {repo?.fullName || c.repoId} ({c.branch}) · {c.authorName}
                      </span>
                      <span className="tabular-nums">
                        {new Date(c.createdAt).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    {c.s3ObjectKey && (
                      <div className="mt-1 font-mono text-[10px] text-emerald-700">
                        LFS/S3: s3://{c.s3ObjectKey}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Create Office Document Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Новый документ Univer"
        subtitle="Файл сохраняется в Garage S3 и фиксируется в Forgejo"
      >
        <form onSubmit={handleCreateDocument} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-700">Название документа</label>
            <input
              type="text"
              required
              minLength={2}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Например: Расчёт экономики сделки Q4"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0077FF]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Формат Univer / OOXML</label>
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as OfficeDocKind)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
            >
              <option value="xlsx">Univer Sheets — Таблица (.xlsx)</option>
              <option value="docx">Univer Docs — Документ (.docx)</option>
              <option value="pptx">Univer Slides — Презентация (.pptx)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Связать со сделкой CRM</label>
            <select
              value={newDealId}
              onChange={(e) => setNewDealId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
            >
              <option value="">— Без привязки —</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Создать в S3 и Forgejo
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
