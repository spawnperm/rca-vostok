import React from 'react';
import type { DealEmailContext } from '../../domain/crm/entities.ts';
import { EmailTemplatesWorkspace, type EmailTemplateRecord } from './EmailTemplatesWorkspace.tsx';
import { Modal } from './ui/Modal.tsx';

export type { EmailTemplateRecord };
export type EmailPreviewContext = DealEmailContext;

interface EmailTemplatesModalProps {
  open: boolean;
  templates: EmailTemplateRecord[];
  initialTemplateId?: string;
  canWrite: boolean;
  previewContext?: DealEmailContext;
  onClose: () => void;
  onTemplatesChange: (nextTemplates: EmailTemplateRecord[]) => void;
  onApplyToDeal?: (template: EmailTemplateRecord) => void;
  onNotify: (msg: string, tone?: 'ok' | 'err') => void;
}

export const EmailTemplatesModal: React.FC<EmailTemplatesModalProps> = ({
  open,
  templates,
  initialTemplateId,
  canWrite,
  previewContext,
  onClose,
  onTemplatesChange,
  onApplyToDeal,
  onNotify,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    maxWidthClass="max-w-5xl"
    title="Управление шаблонами Email-рассылок"
    subtitle={`Всего шаблонов: ${templates.length} · Валидация по схеме Zod`}
  >
    <EmailTemplatesWorkspace
      templates={templates}
      initialTemplateId={initialTemplateId}
      canWrite={canWrite}
      previewContext={previewContext}
      onTemplatesChange={onTemplatesChange}
      onApplyToDeal={onApplyToDeal}
      onAfterApply={onClose}
      onNotify={onNotify}
      heightClass="h-[72vh]"
    />
  </Modal>
);
