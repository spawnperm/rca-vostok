import { ValidationError } from '../shared/DomainError.ts';
import { EmailAddress, SanitizedText } from '../shared/ValueObjects.ts';

export interface InquiryRecordDTO {
  id: string;
  fullName: string;
  email: string;
  contactChannel: string;
  region: string;
  track: string;
  experienceNote: string;
  consentAccepted: boolean;
  /** Owning account, when the request came from an authenticated cabinet session. */
  userId: string | null;
  status: InquiryStatus;
  createdAt: string;
}

/** Lifecycle of a request, as shown in the personal cabinet. */
export const INQUIRY_STATUSES = ['new', 'in_review', 'approved', 'rejected'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export interface CreateInquiryInput {
  /** Set by the application layer when the caller is authenticated. */
  userId?: string | null;
  fullName: unknown;
  email: unknown;
  contactChannel?: unknown;
  region?: unknown;
  track?: unknown;
  experienceNote?: unknown;
  consentAccepted?: unknown;
}

export class CertificationInquiry {
  readonly id: string;
  readonly fullName: SanitizedText;
  readonly email: EmailAddress;
  readonly contactChannel: SanitizedText;
  readonly region: string;
  readonly track: string;
  readonly experienceNote: SanitizedText;
  readonly consentAccepted: true;
  readonly userId: string | null;
  readonly status: InquiryStatus;
  readonly createdAt: string;

  private constructor(props: {
    id: string;
    fullName: SanitizedText;
    email: EmailAddress;
    contactChannel: SanitizedText;
    region: string;
    track: string;
    experienceNote: SanitizedText;
    consentAccepted: true;
    userId: string | null;
    status: InquiryStatus;
    createdAt: string;
  }) {
    this.id = props.id;
    this.fullName = props.fullName;
    this.email = props.email;
    this.contactChannel = props.contactChannel;
    this.region = props.region;
    this.track = props.track;
    this.experienceNote = props.experienceNote;
    this.consentAccepted = props.consentAccepted;
    this.userId = props.userId;
    this.status = props.status;
    this.createdAt = props.createdAt;
  }

  static create(input: CreateInquiryInput): CertificationInquiry {
    const fullName = SanitizedText.create(input.fullName, {
      fieldLabel: 'ФИО или имя',
      minLen: 2,
      maxLen: 120,
    });
    const email = EmailAddress.create(input.email);

    if (input.consentAccepted !== true) {
      throw new ValidationError(
        'Необходимо подтвердить согласие на получение уведомлений.'
      );
    }

    const contactChannel = SanitizedText.create(input.contactChannel ?? '', {
      fieldLabel: 'Контактный канал',
      maxLen: 100,
    });
    const experienceNote = SanitizedText.create(input.experienceNote ?? '', {
      fieldLabel: 'Походный опыт',
      maxLen: 600,
    });
    const region = SanitizedText.sanitizeRaw(input.region, 80) || 'Приморский край';
    const track = SanitizedText.sanitizeRaw(input.track, 100) || 'Пешеходный туризм';

    return new CertificationInquiry({
      id: `inq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fullName,
      email,
      contactChannel,
      region,
      track,
      experienceNote,
      consentAccepted: true,
      userId: SanitizedText.sanitizeRaw(input.userId, 64) || null,
      status: 'new',
      createdAt: new Date().toISOString(),
    });
  }


  /** Rebuilds an aggregate from persistence without re-running field rules. */
  static rehydrate(props: {
    id: string;
    fullName: string;
    email: string;
    contactChannel: string;
    region: string;
    track: string;
    experienceNote: string;
    consentAccepted: boolean;
    userId: string | null;
    status: InquiryStatus;
    createdAt: string;
  }): CertificationInquiry {
    return new CertificationInquiry({
      id: props.id,
      fullName: SanitizedText.rehydrate(props.fullName),
      email: EmailAddress.rehydrate(props.email),
      contactChannel: SanitizedText.rehydrate(props.contactChannel),
      region: props.region,
      track: props.track,
      experienceNote: SanitizedText.rehydrate(props.experienceNote),
      consentAccepted: true,
      userId: props.userId,
      status: props.status,
      createdAt: props.createdAt,
    });
  }

  /** Changes the review status. Only a moderator reaches this path. */
  withStatus(status: InquiryStatus): CertificationInquiry {
    return new CertificationInquiry({
      id: this.id,
      fullName: this.fullName,
      email: this.email,
      contactChannel: this.contactChannel,
      region: this.region,
      track: this.track,
      experienceNote: this.experienceNote,
      consentAccepted: this.consentAccepted,
      userId: this.userId,
      status,
      createdAt: this.createdAt,
    });
  }

  toDTO(): InquiryRecordDTO {
    return {
      id: this.id,
      fullName: this.fullName.value,
      email: this.email.value,
      contactChannel: this.contactChannel.value,
      region: this.region,
      track: this.track,
      experienceNote: this.experienceNote.value,
      consentAccepted: this.consentAccepted,
      userId: this.userId,
      status: this.status,
      createdAt: this.createdAt,
    };
  }
}
