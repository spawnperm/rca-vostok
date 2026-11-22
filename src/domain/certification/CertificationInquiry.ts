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
  createdAt: string;
}

export interface CreateInquiryInput {
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
      createdAt: new Date().toISOString(),
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
      createdAt: this.createdAt,
    };
  }
}
