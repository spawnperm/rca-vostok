import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import {
  SECTION_SEO_MAP,
  type LiveSeoAuditResult,
  type SiteTabId,
} from '../../utils/seo';
import { generateSitemap } from '../../utils/sitemapGenerator';
import type { ServerSeoStatus } from './types';

interface SeoAuditTabProps {
  seoAudit: LiveSeoAuditResult;
  serverSeo: ServerSeoStatus | null;
}

const LOCAL_SITEMAP_STATS = generateSitemap();

export const SeoAuditTab: React.FC<SeoAuditTabProps> = ({ seoAudit, serverSeo }) => {
  const [previewSeoTab, setPreviewSeoTab] = useState<SiteTabId>('home');
  const previewSeo = SECTION_SEO_MAP[previewSeoTab];
  const indexedCount = serverSeo?.indexedRoutes ?? LOCAL_SITEMAP_STATS.entries.length;
  const indexedSections = serverSeo?.indexedSections ?? LOCAL_SITEMAP_STATS.sectionCount;
  const indexedSubSections = serverSeo?.indexedSubSections ?? LOCAL_SITEMAP_STATS.subSectionCount;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Живой аудит SEO текущей страницы
            </h2>
            <p className="text-xs text-slate-500">
              Автоматическая проверка мета-тегов, OpenGraph, микроразметки и заголовков в DOM
            </p>
          </div>
          <span className="font-mono text-2xl font-bold text-teal-700 tabular-nums">
            {seoAudit.score}%
          </span>
        </div>

        <div className="divide-y divide-slate-200">
          {seoAudit.checks.map((chk) => (
            <div key={chk.id} className="py-3 flex items-start justify-between gap-4 text-xs">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  {chk.status === 'pass' ? (
                    <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                  )}
                  <span className="font-semibold text-slate-900">{chk.label}</span>
                </div>
                <p className="text-slate-500 pl-6 truncate">{chk.valuePreview}</p>
              </div>
              <span className="font-mono text-[11px] text-slate-600 shrink-0 tabular-nums">
                {chk.detail}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">Превью сниппета в поиске</h2>
            <select
              aria-label="Выберите раздел для превью SEO"
              value={previewSeoTab}
              onChange={(e) => setPreviewSeoTab(e.target.value as SiteTabId)}
              className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-slate-800"
            >
              {Object.values(SECTION_SEO_MAP).map((s) => (
                <option key={s.tab} value={s.tab}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
            <p className="text-[11px] text-slate-500 font-mono truncate">
              {serverSeo?.baseUrl || window.location.origin}/{previewSeo.pathQuery}
            </p>
            <p className="text-base font-semibold text-blue-800 leading-snug">
              {previewSeo.title}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">{previewSeo.description}</p>
            <p className="text-[11px] font-mono text-slate-400 pt-1 tabular-nums">
              title: {previewSeo.title.length} симв. · description:{' '}
              {previewSeo.description.length} симв.
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Технические файлы индексации</h2>
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">robots.txt</p>
                <p className="text-slate-500">Разрешает индексацию, закрывает /api/</p>
              </div>
              <a
                href="/robots.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 hover:text-teal-900 font-medium inline-flex items-center gap-1 shrink-0"
              >
                <span>Открыть</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">sitemap.xml</p>
                <p className="text-slate-500 font-mono tabular-nums">
                  {indexedCount} URL ({indexedSections} разд. + {indexedSubSections} подразд.)
                </p>
              </div>
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 hover:text-teal-900 font-medium inline-flex items-center gap-1 shrink-0"
              >
                <span>Открыть</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
