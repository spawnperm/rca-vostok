import { ValidationError } from '../shared/DomainError.ts';
import { EmailAddress, SanitizedText } from '../shared/ValueObjects.ts';

export const LINKED_PROVIDERS = [
  'google',
  'vk',
  'telegram',
  'yandex',
  'github',
  'rca_social',
] as const;

export type LinkedProviderId = (typeof LINKED_PROVIDERS)[number];

export const OAUTH_PROVIDERS = ['google', 'vk', 'yandex', 'github'] as const;
export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number];

export type ConnectionMethod = 'oauth' | 'profile_link' | 'internal_social';

export interface LinkedAccountDTO {
  provider: LinkedProviderId;
  connectionMethod: ConnectionMethod;
  externalId: string;
  displayName: string;
  email: string;
  contactChannel: string;
  region: string;
  organisation: string;
  profileUrl: string;
  preferredTrack: string;
  experienceSummary: string;
  useForExamAutofill: boolean;
  linkedAt: string;
  updatedAt: string;
}

export interface LinkedAccountInput {
  provider: unknown;
  externalId?: unknown;
  displayName?: unknown;
  email?: unknown;
  contactChannel?: unknown;
  region?: unknown;
  organisation?: unknown;
  profileUrl?: unknown;
  preferredTrack?: unknown;
  experienceSummary?: unknown;
  useForExamAutofill?: unknown;
}

export interface ExamAutofillPayload {
  sourceProvider: LinkedProviderId;
  sourceLabel: string;
  connectionMethod: ConnectionMethod;
  fullName: string;
  email: string;
  contactChannel: string;
  region: string;
  organisation: string;
  preferredDiscipline: string;
  preferredTrack: string;
  experienceNote: string;
}

export const LINKED_PROVIDER_META: Record<
  LinkedProviderId,
  {
    id: LinkedProviderId;
    label: string;
    shortLabel: string;
    supportsOAuth: boolean;
    placeholderUrl: string;
    contactHint: string;
  }
> = {
  google: {
    id: 'google',
    label: 'Google-аккаунт',
    shortLabel: 'Google',
    supportsOAuth: true,
    placeholderUrl: 'https://profiles.google.com',
    contactHint: 'tatyana.smirnova@gmail.com',
  },
  vk: {
    id: 'vk',
    label: 'ВКонтакте',
    shortLabel: 'ВКонтакте',
    supportsOAuth: true,
    placeholderUrl: 'https://vk.com/username',
    contactHint: 'https://vk.com/id12345 или @username',
  },
  telegram: {
    id: 'telegram',
    label: 'Telegram',
    shortLabel: 'Telegram',
    supportsOAuth: false,
    placeholderUrl: 'https://t.me/username',
    contactHint: '@guide_vostok или https://t.me/guide_vostok',
  },
  yandex: {
    id: 'yandex',
    label: 'Яндекс ID',
    shortLabel: 'Яндекс',
    supportsOAuth: true,
    placeholderUrl: 'https://id.yandex.ru',
    contactHint: 'guide@yandex.ru',
  },
  github: {
    id: 'github',
    label: 'GitHub',
    shortLabel: 'GitHub',
    supportsOAuth: true,
    placeholderUrl: 'https://github.com/username',
    contactHint: 'https://github.com/username',
  },
  rca_social: {
    id: 'rca_social',
    label: 'Социальный профиль РЦА',
    shortLabel: 'Профиль РЦА',
    supportsOAuth: false,
    placeholderUrl: '',
    contactHint: 'Профиль инструктора в сообществе РЦА',
  },
};

export function isLinkedProvider(value: unknown): value is LinkedProviderId {
  return typeof value === 'string' && (LINKED_PROVIDERS as readonly string[]).includes(value);
}

export function isOAuthProvider(value: unknown): value is OAuthProviderId {
  return typeof value === 'string' && (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/** Validates and normalizes an external http(s) URL, blocking dangerous schemes. */
export function normalizeSafeHttpUrl(raw: unknown): string {
  const cleaned = SanitizedText.sanitizeRaw(raw, 240);
  if (!cleaned) return '';

  const withScheme =
    /^(vk\.com|t\.me|github\.com|ok\.ru)\//i.test(cleaned)
      ? `https://${cleaned}`
      : cleaned;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new ValidationError('Укажите корректную ссылку на профиль (начиная с https://).');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ValidationError('Допускаются только веб-ссылки http:// или https://.');
  }

  return parsed.toString();
}

function normalizeContactAndUrl(
  provider: LinkedProviderId,
  rawContact: string,
  rawUrl: string
): { contactChannel: string; profileUrl: string; externalId: string } {
  let profileUrl = rawUrl ? normalizeSafeHttpUrl(rawUrl) : '';
  let contactChannel = rawContact;
  let externalId = '';

  if (provider === 'telegram') {
    const handleMatch =
      rawContact.match(/^@?([a-zA-Z0-9_]{4,32})$/) ??
      profileUrl.match(/^https?:\/\/t\.me\/([a-zA-Z0-9_]{4,32})\/?$/i);
    if (handleMatch) {
      const handle = handleMatch[1];
      contactChannel = `@${handle}`;
      profileUrl = profileUrl || `https://t.me/${handle}`;
      externalId = handle.toLowerCase();
    }
  } else if (provider === 'vk') {
    const vkSlugMatch =
      profileUrl.match(/^https?:\/\/(?:m\.)?vk\.com\/([a-zA-Z0-9_.]{3,64})\/?$/i) ??
      rawContact.match(/^(?:https?:\/\/)?vk\.com\/([a-zA-Z0-9_.]{3,64})\/?$/i);
    if (vkSlugMatch) {
      const slug = vkSlugMatch[1];
      profileUrl = `https://vk.com/${slug}`;
      contactChannel = contactChannel || `vk.com/${slug}`;
      externalId = slug.toLowerCase();
    }
  } else if (provider === 'github') {
    const ghMatch =
      profileUrl.match(/^https?:\/\/github\.com\/([a-zA-Z0-9-]{1,39})\/?$/i) ??
      rawContact.match(/^@?([a-zA-Z0-9-]{1,39})$/);
    if (ghMatch) {
      const login = ghMatch[1];
      profileUrl = profileUrl || `https://github.com/${login}`;
      contactChannel = contactChannel || `github.com/${login}`;
      externalId = login.toLowerCase();
    }
  }

  if (!externalId) {
    externalId = (profileUrl || contactChannel).toLowerCase().slice(0, 120);
  }

  return { contactChannel, profileUrl, externalId };
}

export function normalizeManualLinkedAccount(
  input: LinkedAccountInput,
  fallback: { fullName: string; email: string; region: string; organisation: string },
  existingLinkedAt?: string
): LinkedAccountDTO {
  if (!isLinkedProvider(input.provider)) {
    throw new ValidationError('Выбран неподдерживаемый сервис для привязки профиля.');
  }

  const displayName =
    SanitizedText.sanitizeRaw(input.displayName, 120) || fallback.fullName;

  const rawEmail = SanitizedText.sanitizeRaw(input.email, 160);
  const email = rawEmail
    ? EmailAddress.create(rawEmail).value
    : input.provider === 'google' || input.provider === 'yandex'
      ? fallback.email
      : '';

  const rawContact = SanitizedText.sanitizeRaw(input.contactChannel, 120);
  const rawUrl = SanitizedText.sanitizeRaw(input.profileUrl, 240);

  if (
    input.provider !== 'rca_social' &&
    !rawContact &&
    !rawUrl &&
    !email
  ) {
    throw new ValidationError(
      'Укажите ссылку на профиль, контакт (@username / телефон) или email для связи.'
    );
  }

  const { contactChannel, profileUrl, externalId: inferredId } = normalizeContactAndUrl(
    input.provider,
    rawContact || email,
    rawUrl
  );

  const explicitExternalId = SanitizedText.sanitizeRaw(input.externalId, 120);
  const externalId = explicitExternalId || inferredId || input.provider;
  const region = SanitizedText.sanitizeRaw(input.region, 80) || fallback.region;
  const organisation =
    SanitizedText.sanitizeRaw(input.organisation, 160) || fallback.organisation;
  const preferredTrack = SanitizedText.sanitizeRaw(input.preferredTrack, 100);
  const experienceSummary = SanitizedText.sanitizeRaw(input.experienceSummary, 400);
  const now = new Date().toISOString();

  return {
    provider: input.provider,
    connectionMethod:
      input.provider === 'rca_social' ? 'internal_social' : 'profile_link',
    externalId,
    displayName,
    email,
    contactChannel,
    region,
    organisation,
    profileUrl,
    preferredTrack,
    experienceSummary,
    useForExamAutofill: input.useForExamAutofill !== false,
    linkedAt: existingLinkedAt || now,
    updatedAt: now,
  };
}

/** Maps track or skills text to one of the canonical calendar exam disciplines. */
export function inferExamDiscipline(
  preferredTrack: string,
  experienceSummary = ''
): 'пешеходный' | 'водный' | 'горный' | 'спелеологический' {
  const haystack = `${preferredTrack} ${experienceSummary}`.toLowerCase();
  if (/водн|сплав|байдар|рафт|каяк/.test(haystack)) return 'водный';
  if (/горн|альп|восхожд|вулкан/.test(haystack)) return 'горный';
  if (/спелео|пещер/.test(haystack)) return 'спелеологический';
  return 'пешеходный';
}

export function buildExamAutofillFromAccounts(
  user: { fullName: string; email: string; region: string; organisation: string },
  accounts: readonly LinkedAccountDTO[],
  preferredProvider?: LinkedProviderId | null
): ExamAutofillPayload | null {
  if (accounts.length === 0) return null;

  const chosen =
    (preferredProvider
      ? accounts.find((a) => a.provider === preferredProvider)
      : undefined) ??
    accounts.find((a) => a.useForExamAutofill) ??
    accounts[0];

  if (!chosen) return null;

  const meta = LINKED_PROVIDER_META[chosen.provider];
  const preferredDiscipline = inferExamDiscipline(
    chosen.preferredTrack,
    chosen.experienceSummary
  );

  const trackLabelMap: Record<typeof preferredDiscipline, string> = {
    пешеходный: 'Пешеходный туризм',
    водный: 'Водный туризм',
    горный: 'Горный туризм',
    спелеологический: 'Спелеологический туризм',
  };

  const experienceParts: string[] = [];
  if (chosen.organisation || user.organisation) {
    experienceParts.push(`Организация: ${chosen.organisation || user.organisation}`);
  }
  if (chosen.experienceSummary) {
    experienceParts.push(chosen.experienceSummary);
  }
  if (chosen.profileUrl) {
    experienceParts.push(`Профиль: ${chosen.profileUrl}`);
  }

  return {
    sourceProvider: chosen.provider,
    sourceLabel: meta.label,
    connectionMethod: chosen.connectionMethod,
    fullName: chosen.displayName || user.fullName,
    email: chosen.email || user.email,
    contactChannel: chosen.contactChannel || chosen.email || user.email,
    region: chosen.region || user.region,
    organisation: chosen.organisation || user.organisation,
    preferredDiscipline,
    preferredTrack: chosen.preferredTrack || trackLabelMap[preferredDiscipline],
    experienceNote: experienceParts.join(' · ').slice(0, 500),
  };
}

export interface LinkedAccountsRepository {
  findByUserId(userId: string): Promise<LinkedAccountDTO[]>;
  upsert(userId: string, account: LinkedAccountDTO): Promise<LinkedAccountDTO[]>;
  setAutofillSource(
    userId: string,
    provider: LinkedProviderId | null
  ): Promise<LinkedAccountDTO[]>;
  unlink(userId: string, provider: LinkedProviderId): Promise<LinkedAccountDTO[]>;
}
