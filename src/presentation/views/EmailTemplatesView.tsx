import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, Mail, RefreshCw } from 'lucide-react';
import { refineClient } from '../../application/refine/client.ts';
import { useVoiceSectionAction } from '../../application/voice/voiceActionBus.ts';
import type { AuthenticatedActor } from '../../domain/shared/types.ts';
import { EmailAbTestingPanel } from '../components/EmailAbTestingPanel.tsx';
import {
  EmailTemplatesWorkspace,
  type EmailTemplateRecord,
} from '../components/EmailTemplatesWorkspace.tsx';
import { PageHeader } from '../components/ui/PageHeader.tsx';

interface EmailTemplatesViewProps {
  actor: AuthenticatedActor;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

export const EmailTemplatesView: React.FC<EmailTemplatesViewProps> = ({ actor, onNotify }) => {
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [createSignal, setCreateSignal] = useState(0);
  const [activeTab, setActiveTab] = useState<'templates' | 'ab_testing'>('templates');
  const canWrite = refineClient.can(actor, 'deals:write');

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await refineClient.request<{ templates: EmailTemplateRecord[] }>(
        '/api/crm/email-templates'
      );
      setTemplates(data.templates);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Не удалось загрузить шаблоны', 'err');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useVoiceSectionAction('templates', (actionId) => {
    switch (actionId) {
      case 'templates.create_template':
        if (!canWrite) return false;
        setActiveTab('templates');
        setCreateSignal((s) => s + 1);
        return true;
      case 'templates.refresh':
        void loadTemplates();
        return true;
      default:
        return false;
    }
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Шаблоны Email-рассылок и A/B тесты CRM"
        subtitle={`Персонализированные шаблоны с переменными amoCRM · Доступно: ${templates.length}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('templates')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'templates'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                Шаблоны
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ab_testing')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'ab_testing'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                A/B-тесты
              </button>
            </div>
            <button
              type="button"
              onClick={() => void loadTemplates()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </button>
          </div>
        }
      />

      {activeTab === 'ab_testing' ? (
        <EmailAbTestingPanel
          canWrite={canWrite}
          onTemplateApplied={(tpl) => {
            setTemplates((prev) => [tpl, ...prev]);
            setActiveTab('templates');
          }}
          onNotify={onNotify}
        />
      ) : loading && templates.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
          <Mail className="mr-2 h-4 w-4 text-slate-400" />
          Загрузка шаблонов писем...
        </div>
      ) : (
        <EmailTemplatesWorkspace
          templates={templates}
          canWrite={canWrite}
          createSignal={createSignal}
          onTemplatesChange={setTemplates}
          onNotify={onNotify}
        />
      )}
    </div>
  );
};
