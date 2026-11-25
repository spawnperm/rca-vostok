import type { EmailTemplateCategory } from '../domain/crm/entities.ts';

export type PortalSectionId =
  | 'dashboard'
  | 'chat'
  | 'profile'
  | 'deals'
  | 'contacts'
  | 'tasks'
  | 'calendar'
  | 'templates'
  | 'office'
  | 'collections'
  | 'workflows'
  | 'marketplace'
  | 'admin'
  | 'devtools';

export interface DealNextStepProposal {
  actionType: 'call' | 'meeting' | 'followup' | 'dify_ai';
  title: string;
  rationale: string;
  suggestedDueAt: string;
}

export interface DealHarnessAnalysis {
  dealId: string;
  runId: string;
  winProbability: number;
  riskLevel: 'Низкий' | 'Средний' | 'Высокий';
  contactHistorySummary: string;
  historySignalsCount: number;
  siblingDealsCount: number;
  nextStep: DealNextStepProposal;
  analyzedAt: string;
  trigger: string;
}

export interface PipelineItem {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface StageItem {
  id: string;
  pipelineId: string;
  name: string;
  color: string;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
}

export interface DealItem {
  id: string;
  pipelineId: string;
  stageId: string;
  title: string;
  budget: number;
  currency: string;
  contactId: string | null;
  companyId: string | null;
  ownerId: string;
  tags: string[];
  customFields: Record<string, string>;
  lossReason?: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail?: string | null;
  companyName: string | null;
  ownerName: string;
  ownerAvatar: string;
  openTasksCount: number;
  hasOverdueTask: boolean;
  nextTaskDueAt: string | null;
  createdAt: string;
  updatedAt: string;
  harnessAnalysis?: DealHarnessAnalysis | null;
}

export interface ContactItem {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  position: string;
  companyId?: string | null;
  companyName: string;
  tags: string[];
  customFields?: Record<string, unknown>;
  dealsCount?: number;
  dealsBudget?: number;
  createdAt?: string;
}

export interface CompanyItem {
  id: string;
  name: string;
  industry: string;
  website: string;
  phone: string;
  customFields?: Record<string, unknown>;
  dealsCount?: number;
  dealsBudget?: number;
  createdAt?: string;
}

export interface TaskItem {
  id: string;
  dealId: string | null;
  dealTitle: string | null;
  assigneeId: string;
  assigneeName: string;
  assigneeAvatar: string;
  taskType: 'call' | 'meeting' | 'followup' | 'dify_ai' | string;
  title: string;
  dueAt: string;
  reminderAt?: string | null;
  reminderNotifiedAt?: string | null;
  deadlineNotifiedAt?: string | null;
  durationMinutes?: number;
  completed: boolean;
}

export interface EmailTemplateItem {
  id: string;
  name: string;
  category: EmailTemplateCategory;
  subject: string;
  body: string;
  createdBy: string;
  createdAt: string;
}

export interface OwnerOption {
  id: string;
  fullName: string;
  avatarUrl: string;
}
