import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Database,
  Download,
  Eye,
  File,
  FileArchive,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderUp,
  HardDrive,
  Image as ImageIcon,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  type GarageBucketSummary,
  type GarageClusterInfo,
  type GarageObjectPreviewResponse,
  type GarageObjectSummary,
  garageS3Client,
} from '../../application/office/garageS3Client.ts';
import { formatBytes } from '../../shared/formatters.ts';
import { Modal } from './ui/Modal.tsx';

interface GarageFileManagerProps {
  tenantSubdomain: string;
  cluster: GarageClusterInfo;
  buckets: GarageBucketSummary[];
  allObjects: GarageObjectSummary[];
  canWrite: boolean;
  onRefreshWorkspace: () => Promise<void>;
  onOpenUniverDocument: (docId: string) => void;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

function getFileIcon(contentType: string, objectKey: string) {
  const ext = (objectKey.split('.').pop() || '').toLowerCase();
  const mime = contentType.toLowerCase();
  if (mime.startsWith('image/') && ext !== 'svg') {
    return <ImageIcon className="h-4 w-4 shrink-0 text-violet-600" />;
  }
  if (ext === 'xlsx' || ext === 'csv') {
    return <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />;
  }
  if (['json', 'yaml', 'yml', 'xml', 'sql', 'ts', 'tsx', 'js', 'html', 'css', 'svg'].includes(ext)) {
    return <FileCode2 className="h-4 w-4 shrink-0 text-amber-600" />;
  }
  if (['zip', 'tar', 'gz', '7z', 'rar'].includes(ext) || mime.includes('zip')) {
    return <FileArchive className="h-4 w-4 shrink-0 text-slate-600" />;
  }
  if (mime === 'application/pdf' || ['pdf', 'doc', 'docx', 'md', 'txt'].includes(ext)) {
    return <FileText className="h-4 w-4 shrink-0 text-[#0077FF]" />;
  }
  return <File className="h-4 w-4 shrink-0 text-slate-500" />;
}

export const GarageFileManager: React.FC<GarageFileManagerProps> = ({
  tenantSubdomain,
  cluster,
  buckets,
  allObjects,
  canWrite,
  onRefreshWorkspace,
  onOpenUniverDocument,
  onNotify,
}) => {
  const [selectedBucket, setSelectedBucket] = useState<string>(() => buckets[0]?.name || '__all__');
  const [currentPrefix, setCurrentPrefix] = useState<string>('');
  const [uploadPrefix, setUploadPrefix] = useState<string>('');
  const [s3Search, setS3Search] = useState<string>('');
  const [bucketObjects, setBucketObjects] = useState<GarageObjectSummary[] | null>(null);
  const [loadingBucket, setLoadingBucket] = useState(false);

  const [newBucketName, setNewBucketName] = useState('');
  const [creatingBucket, setCreatingBucket] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<GarageObjectPreviewResponse | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<GarageObjectSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectedBucket !== '__all__' && !buckets.some((b) => b.name === selectedBucket)) {
      setSelectedBucket(buckets[0]?.name || '__all__');
      setCurrentPrefix('');
      setUploadPrefix('');
      setBucketObjects(null);
    }
  }, [buckets, selectedBucket]);

  const revokePreviewBlob = useCallback(() => {
    setPreviewBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  const fetchSelectedBucketObjects = useCallback(
    async (bucketName: string) => {
      if (bucketName === '__all__') {
        setBucketObjects(null);
        return;
      }
      setLoadingBucket(true);
      try {
        const res = await garageS3Client.listBucketObjects(bucketName);
        setBucketObjects(res.objects);
      } catch (err: unknown) {
        onNotify(err instanceof Error ? err.message : 'Ошибка чтения бакета Garage S3', 'err');
      } finally {
        setLoadingBucket(false);
      }
    },
    [onNotify]
  );

  useEffect(() => {
    if (selectedBucket !== '__all__') {
      void fetchSelectedBucketObjects(selectedBucket);
    } else {
      setBucketObjects(null);
    }
  }, [selectedBucket, fetchSelectedBucketObjects]);

  const handleSelectBucket = (bucketName: string) => {
    setSelectedBucket(bucketName);
    setCurrentPrefix('');
    setUploadPrefix('');
  };

  const navigatePrefix = (nextPrefix: string) => {
    const normalized = nextPrefix.replace(/^\/+|\/+$/g, '');
    const withSlash = normalized ? `${normalized}/` : '';
    setCurrentPrefix(withSlash);
    setUploadPrefix(normalized);
  };

  const activeBucketObjects = useMemo(() => {
    if (selectedBucket === '__all__') {
      return allObjects;
    }
    if (bucketObjects !== null) {
      return bucketObjects;
    }
    return allObjects.filter((o) => o.bucketName === selectedBucket);
  }, [selectedBucket, bucketObjects, allObjects]);

  const { visibleFolders, visibleObjects } = useMemo(() => {
    const q = s3Search.trim().toLowerCase();
    if (q || selectedBucket === '__all__') {
      const filtered = activeBucketObjects.filter((obj) => {
        if (!q) return true;
        return (
          obj.objectKey.toLowerCase().includes(q) ||
          obj.bucketName.toLowerCase().includes(q) ||
          obj.contentType.toLowerCase().includes(q)
        );
      });
      return { visibleFolders: [] as Array<{ name: string; fullPrefix: string; count: number }>, visibleObjects: filtered };
    }

    const folderMap = new Map<string, number>();
    const files: GarageObjectSummary[] = [];

    for (const obj of activeBucketObjects) {
      if (currentPrefix && !obj.objectKey.startsWith(currentPrefix)) {
        continue;
      }
      const rest = currentPrefix ? obj.objectKey.slice(currentPrefix.length) : obj.objectKey;
      const slashIdx = rest.indexOf('/');
      if (slashIdx > 0) {
        const folderName = rest.slice(0, slashIdx);
        const fullPrefix = `${currentPrefix}${folderName}`;
        folderMap.set(fullPrefix, (folderMap.get(fullPrefix) || 0) + 1);
      } else {
        files.push(obj);
      }
    }

    const folders = Array.from(folderMap.entries())
      .map(([fullPrefix, count]) => ({
        name: fullPrefix.split('/').pop() || fullPrefix,
        fullPrefix,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    return { visibleFolders: folders, visibleObjects: files };
  }, [activeBucketObjects, currentPrefix, s3Search, selectedBucket]);

  const totalTenantBytes = useMemo(
    () => allObjects.reduce((sum, obj) => sum + obj.sizeBytes, 0),
    [allObjects]
  );

  const handleUploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const targetBucket = selectedBucket === '__all__' ? buckets[0]?.name : selectedBucket;
    if (!targetBucket) {
      onNotify('Создайте бакет Garage S3 перед загрузкой файлов', 'err');
      return;
    }

    setUploadingCount(list.length);
    let uploaded = 0;
    try {
      for (const file of list) {
        await garageS3Client.uploadFile({
          bucketName: targetBucket,
          prefix: uploadPrefix,
          file,
        });
        uploaded += 1;
      }
      await Promise.all([
        onRefreshWorkspace(),
        selectedBucket !== '__all__' ? fetchSelectedBucketObjects(targetBucket) : Promise.resolve(),
      ]);
      onNotify(
        uploaded === 1
          ? `Файл «${list[0].name}» загружен в s3://${targetBucket}`
          : `Загружено файлов в Garage S3: ${uploaded}`
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка загрузки файла в Garage S3', 'err');
    } finally {
      setUploadingCount(0);
    }
  };

  const handleCreateBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newBucketName.trim().toLowerCase();
    if (!name) return;
    setCreatingBucket(true);
    try {
      const res = await garageS3Client.createBucket({ name });
      setNewBucketName('');
      await onRefreshWorkspace();
      setSelectedBucket(res.bucket.name);
      setCurrentPrefix('');
      setUploadPrefix('');
      onNotify(`Бакет Garage S3 «${res.bucket.name}» создан`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка создания бакета', 'err');
    } finally {
      setCreatingBucket(false);
    }
  };

  const handlePreviewObject = async (obj: GarageObjectSummary) => {
    revokePreviewBlob();
    setPreviewLoading(true);
    try {
      const res = await garageS3Client.getObjectPreview(obj.id);
      if (res.preview.mode === 'image' || res.preview.mode === 'pdf') {
        const blobUrl = await garageS3Client.fetchObjectBlobUrl(obj.id, true);
        setPreviewBlobUrl(blobUrl);
      }
      setPreviewData(res);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Не удалось открыть предпросмотр файла', 'err');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreviewModal = () => {
    revokePreviewBlob();
    setPreviewData(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await garageS3Client.deleteObject(deleteTarget.id);
      const bucketName = deleteTarget.bucketName;
      setDeleteTarget(null);
      if (previewData?.object.id === deleteTarget.id) {
        closePreviewModal();
      }
      await Promise.all([
        onRefreshWorkspace(),
        selectedBucket === bucketName ? fetchSelectedBucketObjects(bucketName) : Promise.resolve(),
      ]);
      onNotify(`Объект «${deleteTarget.objectKey}» удалён из Garage S3`);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Ошибка удаления объекта S3', 'err');
    } finally {
      setDeleting(false);
    }
  };

  const handleRefresh = async () => {
    await onRefreshWorkspace();
    if (selectedBucket !== '__all__') {
      await fetchSelectedBucketObjects(selectedBucket);
    }
  };

  const breadcrumbSegments = currentPrefix
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* LEFT PANEL: TENANT BUCKETS & CLUSTER */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">Бакеты тенанта ({buckets.length})</h2>
          </div>
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-600">
            {cluster.s3Sdk || '@aws-sdk/client-s3'}
          </span>
        </div>

        <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-slate-800">{cluster.endpoint}</span>
            <span className="shrink-0 font-mono text-[10px] text-emerald-700">{cluster.mode}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Регион: {cluster.region} · Контур: {tenantSubdomain} · Занято: {formatBytes(totalTenantBytes)}
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleSelectBucket('__all__')}
            className={`w-full rounded-lg border p-3 text-left text-xs transition-colors ${
              selectedBucket === '__all__'
                ? 'border-[#0077FF] bg-blue-50/70'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between font-semibold text-slate-900">
              <span className="inline-flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-[#0077FF]" />
                Все бакеты тенанта
              </span>
              <span className="text-slate-500 tabular-nums">{allObjects.length} объектов</span>
            </div>
          </button>

          {buckets.map((b) => {
            const count =
              b.objectCount ?? allObjects.filter((o) => o.bucketName === b.name).length;
            const usedBytes =
              b.usedBytes ??
              allObjects
                .filter((o) => o.bucketName === b.name)
                .reduce((acc, o) => acc + o.sizeBytes, 0);
            const quotaBytes = b.quotaMb * 1024 * 1024;
            const pct = quotaBytes > 0 ? Math.min(100, Math.max(2, (usedBytes / quotaBytes) * 100)) : 2;
            const active = selectedBucket === b.name;

            return (
              <button
                key={b.id}
                type="button"
                onClick={() => handleSelectBucket(b.name)}
                className={`w-full rounded-lg border p-3 text-left text-xs transition-colors ${
                  active
                    ? 'border-[#0077FF] bg-blue-50/70'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-semibold text-slate-900">
                  <span className="truncate font-mono">{b.name}</span>
                  <span className="shrink-0 text-[11px] font-medium text-slate-500 tabular-nums">
                    {count} файл.
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    {b.region} · {b.visibility}
                  </span>
                  <span className="tabular-nums">
                    {formatBytes(usedBytes)} / {b.quotaMb} МБ
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${usedBytes === 0 ? 0 : pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {canWrite && (
          <form onSubmit={handleCreateBucket} className="space-y-2 border-t border-slate-100 pt-3">
            <label className="block text-xs font-medium text-slate-700">Создать бакет S3</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
                placeholder={`nexus-${tenantSubdomain}-archive`}
                className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-[#0077FF]"
              />
              <button
                type="submit"
                disabled={creatingBucket}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
              >
                {creatingBucket ? '...' : 'Создать'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* RIGHT PANEL: FILE MANAGER */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-8">
        {/* Header & Breadcrumbs */}
        <div className="space-y-3 border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
              <span className="font-mono font-semibold text-slate-900">
                s3://{selectedBucket === '__all__' ? `tenant:${tenantSubdomain}` : selectedBucket}
              </span>
              {selectedBucket !== '__all__' && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => navigatePrefix('')}
                    className={`rounded px-1.5 py-0.5 font-medium ${
                      currentPrefix === ''
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-[#0077FF] hover:bg-blue-50'
                    }`}
                  >
                    Корень
                  </button>
                  {breadcrumbSegments.map((seg, idx) => {
                    const segPrefix = breadcrumbSegments.slice(0, idx + 1).join('/');
                    const isLast = idx === breadcrumbSegments.length - 1;
                    return (
                      <React.Fragment key={segPrefix}>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        <button
                          type="button"
                          onClick={() => navigatePrefix(segPrefix)}
                          className={`rounded px-1.5 py-0.5 font-mono ${
                            isLast ? 'bg-slate-100 font-semibold text-slate-900' : 'text-[#0077FF] hover:bg-blue-50'
                          }`}
                        >
                          {seg}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                title="Обновить список объектов S3"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingBucket ? 'animate-spin' : ''}`} />
                Обновить
              </button>

              {canWrite && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) void handleUploadFiles(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingCount > 0}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingCount > 0 ? `Загрузка (${uploadingCount})...` : 'Загрузить файл в S3'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={s3Search}
                onChange={(e) => setS3Search(e.target.value)}
                placeholder="Поиск по ключу, имени файла или MIME..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#0077FF] focus:bg-white"
              />
            </div>

            {canWrite && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[11px] text-slate-500 whitespace-nowrap">Папка загрузки:</span>
                <input
                  type="text"
                  value={uploadPrefix}
                  onChange={(e) => setUploadPrefix(e.target.value)}
                  placeholder="корень или deals/q4"
                  className="w-44 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-[#0077FF] focus:bg-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* Drag and Drop Upload Area */}
        {canWrite && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files?.length) {
                void handleUploadFiles(e.dataTransfer.files);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`mx-5 mt-4 cursor-pointer rounded-lg border-2 border-dashed px-4 py-3 text-center text-xs transition-colors ${
              isDragOver
                ? 'border-[#0077FF] bg-blue-50 text-[#0077FF]'
                : 'border-slate-200 bg-slate-50/70 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            Перетащите любые файлы сюда или нажмите для загрузки в бакет{' '}
            <span className="font-mono font-semibold text-slate-700">
              {selectedBucket === '__all__' ? buckets[0]?.name || '—' : selectedBucket}
            </span>
            {uploadPrefix ? (
              <span className="font-mono text-slate-700">/{uploadPrefix.replace(/^\/+|\/+$/g, '')}</span>
            ) : null}{' '}
            (до 15 МБ · PDF, изображения, JSON, CSV, Markdown, код, архивы, OOXML)
          </div>
        )}

        {/* Objects Table */}
        <div className="mt-3 flex-1 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-y border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Имя / Ключ S3</th>
                <th className="px-4 py-2.5">Тип / Версия</th>
                <th className="px-4 py-2.5">SHA-256 ETag</th>
                <th className="px-4 py-2.5 text-right">Размер</th>
                <th className="px-4 py-2.5 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selectedBucket !== '__all__' && currentPrefix && !s3Search.trim() && (
                <tr
                  onClick={() => {
                    const parts = breadcrumbSegments.slice(0, -1);
                    navigatePrefix(parts.join('/'));
                  }}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td colSpan={5} className="px-4 py-2.5">
                    <div className="inline-flex items-center gap-2 font-medium text-[#0077FF]">
                      <FolderUp className="h-4 w-4" />
                      <span>.. (На уровень выше)</span>
                    </div>
                  </td>
                </tr>
              )}

              {visibleFolders.map((folder) => (
                <tr
                  key={folder.fullPrefix}
                  onClick={() => navigatePrefix(folder.fullPrefix)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 font-mono font-semibold text-slate-800">
                      <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                      <span>{folder.name}/</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">Папка S3</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">—</td>
                  <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">
                    {folder.count} файл.
                  </td>
                  <td className="px-4 py-2.5 text-right text-[11px] font-medium text-[#0077FF]">
                    Открыть →
                  </td>
                </tr>
              ))}

              {visibleObjects.map((obj) => {
                const displayName =
                  selectedBucket !== '__all__' && !s3Search.trim() && currentPrefix
                    ? obj.objectKey.slice(currentPrefix.length)
                    : obj.objectKey;
                const downloadFileName = obj.objectKey.split('/').pop() || 'file.bin';

                return (
                  <tr key={obj.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">{getFileIcon(obj.contentType, obj.objectKey)}</div>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => void handlePreviewObject(obj)}
                            className="text-left font-mono font-medium text-slate-900 hover:text-[#0077FF]"
                          >
                            {displayName}
                          </button>
                          <div className="font-mono text-[11px] text-slate-400">
                            {obj.bucketName} · {new Date(obj.updatedAt).toLocaleString('ru-RU')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="max-w-[160px] truncate text-[11px] text-slate-600" title={obj.contentType}>
                        {obj.contentType.split(';')[0]}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 tabular-nums">v{obj.versionNumber}</div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                      {obj.etag.slice(0, 12)}…
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-700 tabular-nums whitespace-nowrap">
                      {formatBytes(obj.sizeBytes)}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-1">
                      <button
                        type="button"
                        onClick={() => void handlePreviewObject(obj)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-[#0077FF] hover:text-[#0077FF]"
                        title="Просмотр файла"
                      >
                        <Eye className="h-3 w-3" /> Просмотр
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void garageS3Client.downloadObject(obj.id, downloadFileName).catch((err: unknown) => {
                            onNotify(err instanceof Error ? err.message : 'Ошибка скачивания', 'err');
                          })
                        }
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        title="Скачать через Garage S3"
                      >
                        <Download className="h-3 w-3" /> Скачать
                      </button>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(obj)}
                          aria-label={`Удалить ${obj.objectKey}`}
                          className="inline-flex items-center rounded border border-slate-200 p-1 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          title="Удалить из Garage S3"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {visibleFolders.length === 0 && visibleObjects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">
                    {loadingBucket
                      ? 'Загрузка списка объектов из Garage S3...'
                      : 'В выбранном пути бакета пока нет файлов'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FILE VIEWER MODAL */}
      <Modal
        open={Boolean(previewData) || previewLoading}
        onClose={closePreviewModal}
        title={previewData ? previewData.object.objectKey.split('/').pop() || previewData.object.objectKey : 'Загрузка предпросмотра...'}
        subtitle={
          previewData
            ? `s3://${previewData.object.bucketName}/${previewData.object.objectKey} · ${previewData.object.contentType} · ${formatBytes(previewData.object.sizeBytes)}`
            : undefined
        }
        maxWidthClass="max-w-3xl"
      >
        {previewLoading && !previewData ? (
          <div className="py-10 text-center text-xs text-slate-500">Получение объекта из Garage S3...</div>
        ) : previewData ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600">
              <span>Версия: v{previewData.object.versionNumber}</span>
              <span>ETag: {previewData.object.etag}</span>
              <span>{new Date(previewData.object.updatedAt).toLocaleString('ru-RU')}</span>
            </div>

            {previewData.preview.mode === 'image' && previewBlobUrl && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                <img
                  src={previewBlobUrl}
                  alt={previewData.object.objectKey}
                  className="mx-auto max-h-[460px] rounded object-contain"
                />
              </div>
            )}

            {previewData.preview.mode === 'pdf' && previewBlobUrl && (
              <iframe
                src={previewBlobUrl}
                title={previewData.object.objectKey}
                className="h-[520px] w-full rounded-lg border border-slate-200 bg-white"
              />
            )}

            {previewData.preview.mode === 'text' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Строк: {previewData.preview.lineCount}</span>
                  {previewData.preview.truncated && (
                    <span className="text-amber-700">Показаны первые 512 КБ файла</span>
                  )}
                </div>
                <pre className="max-h-[460px] overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100 whitespace-pre-wrap break-words">
                  {previewData.preview.textContent ?? ''}
                </pre>
              </div>
            )}

            {previewData.preview.mode === 'ooxml' && (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-600">
                <p>
                  Офисный файл формата OOXML сохранён в Garage S3. Вы можете скачать оригинал или открыть его в редакторе Univer Офис.
                </p>
                {previewData.preview.linkedDocumentId && (
                  <button
                    type="button"
                    onClick={() => {
                      const docId = previewData.preview.linkedDocumentId!;
                      closePreviewModal();
                      onOpenUniverDocument(docId);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Открыть в Univer Офис
                  </button>
                )}
              </div>
            )}

            {previewData.preview.mode === 'binary' && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-600">
                Встроенный предпросмотр недоступен для формата <span className="font-mono">{previewData.object.contentType}</span>. Скачайте файл для локального открытия.
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(previewData.object)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Удалить из S3
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closePreviewModal}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Закрыть
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void garageS3Client.downloadObject(
                      previewData.object.id,
                      previewData.object.objectKey.split('/').pop() || 'file.bin'
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Скачать файл
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Удалить файл из Garage S3?"
        subtitle={deleteTarget ? `s3://${deleteTarget.bucketName}/${deleteTarget.objectKey}` : undefined}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 text-xs text-slate-600">
          <p>
            Объект будет удалён из бакета <span className="font-mono font-semibold text-slate-900">{deleteTarget?.bucketName}</span> текущего тенанта без возможности восстановления.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleConfirmDelete()}
              className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Удаление...' : 'Удалить объект'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
