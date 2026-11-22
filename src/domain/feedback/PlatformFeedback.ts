import { ValidationError } from '../shared/DomainError.ts';
import { EmailAddress, SanitizedText } from '../shared/ValueObjects.ts';

export type FeedbackType =
  | 'suggestion'
  | 'question'
  | 'data_correction'
  | 'technical_issue';

export interface PlatformFeedbackDTO {
  id: string;
  senderName: string;
  email: string;
  feedbackType: FeedbackType;
  platformModule: string;
  subject: string;
  message: string;
  createdAt: string;
}

export interface CreatePlatformFeedbackInput {
  senderName: unknown;
  email?: unknown;
  feedbackType?: unknown;
  platformModule?: unknown;
  subject: unknown;
  message: unknown;
}

const VALID_FEEDBACK_TYPES = new Set<FeedbackType>([
  'suggestion',
  'question',
  'data_correction',
  'technical_issue',
]);

export class PlatformFeedback {
  readonly id: string;
  readonly senderName: SanitizedText;
  readonly email: string;
  readonly feedbackType: FeedbackType;
  readonly platformModule: string;
  readonly subject: SanitizedText;
  readonly message: SanitizedText;
  readonly createdAt: string;

  private constructor(props: {
    id: string;
    senderName: SanitizedText;
    email: string;
    feedbackType: FeedbackType;
    platformModule: string;
    subject: SanitizedText;
    message: SanitizedText;
    createdAt: string;
  }) {
    this.id = props.id;
    this.senderName = props.senderName;
    this.email = props.email;
    this.feedbackType = props.feedbackType;
    this.platformModule = props.platformModule;
    this.subject = props.subject;
    this.message = props.message;
    this.createdAt = props.createdAt;
  }

  static create(input: CreatePlatformFeedbackInput): PlatformFeedback {
    const senderName = SanitizedText.create(input.senderName, {
      fieldLabel: 'Имя или организация',
      minLen: 2,
      maxLen: 120,
    });

    const rawEmail = SanitizedText.sanitizeRaw(input.email ?? '', 160);
    let normalizedEmail = '';
    if (rawEmail.length > 0) {
      normalizedEmail = EmailAddress.create(rawEmail).value;
    }

    const rawType = typeof input.feedbackType === 'string' ? input.feedbackType.trim() : '';
    if (!VALID_FEEDBACK_TYPES.has(rawType as FeedbackType)) {
      throw new ValidationError('Укажите корректную категорию обращения.');
    }

    const platformModule =
      SanitizedText.sanitizeRaw(input.platformModule, 80) || 'Весь портал РЦА «Русский Восток»';

    const subject = SanitizedText.create(input.subject, {
      fieldLabel: 'Тема сообщения',
      minLen: 3,
      maxLen: 160,
    });

    const message = SanitizedText.create(input.message, {
      fieldLabel: 'Текст предложения или вопроса',
      minLen: 10,
      maxLen: 1200,
    });

    return new PlatformFeedback({
      id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderName,
      email: normalizedEmail,
      feedbackType: rawType as FeedbackType,
      platformModule,
      subject,
      message,
      createdAt: new Date().toISOString(),
    });
  }

  toDTO(): PlatformFeedbackDTO {
    return {
      id: this.id,
      senderName: this.senderName.value,
      email: this.email,
      feedbackType: this.feedbackType,
      platformModule: this.platformModule,
      subject: this.subject.value,
      message: this.message.value,
      createdAt: this.createdAt,
    };
  }
}
