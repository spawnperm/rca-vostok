import { ValidationError } from '../shared/DomainError.ts';
import { EmailAddress, SanitizedText } from '../shared/ValueObjects.ts';
import { User } from '../identity/User.ts';
import type { Role } from '../identity/Rbac.ts';

/**
 * Extended social profile that sits beside the identity aggregate.
 *
 * Identity owns credentials and RBAC; this context owns presentation and
 * relationships (bio, cover, avatar, contacts, follower graph, activity counters).
 */

export interface SocialProfileDTO {
  userId: string;
  displayName: string;
  headline: string;
  bio: string;
  region: string;
  organisation: string;
  role: Role;
  phone: string;
  telegram: string;
  publicEmail: string;
  vkUrl: string;
  websiteUrl: string;
  coverUrl: string;
  avatarUrl: string;
  coverAssetId: string | null;
  avatarAssetId: string | null;
  skills: string[];
  followerCount: number;
  followingCount: number;
  postCount: number;
  albumCount: number;
  isFollowedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSocialProfileInput {
  displayName?: unknown;
  headline?: unknown;
  bio?: unknown;
  region?: unknown;
  organisation?: unknown;
  phone?: unknown;
  telegram?: unknown;
  publicEmail?: unknown;
  vkUrl?: unknown;
  websiteUrl?: unknown;
  coverUrl?: unknown;
  avatarUrl?: unknown;
  coverAssetId?: unknown;
  avatarAssetId?: unknown;
  skills?: unknown;
}

export const BIO_MAX = 1200;
export const HEADLINE_MAX = 140;
export const AVATAR_DATA_URL_MAX = 180_000;
export const COVER_DATA_URL_MAX = 320_000;

export class SocialProfile {
  readonly userId: string;
  readonly displayName: string;
  readonly headline: string;
  readonly bio: string;
  readonly region: string;
  readonly organisation: string;
  readonly role: Role;
  readonly phone: string;
  readonly telegram: string;
  readonly publicEmail: string;
  readonly vkUrl: string;
  readonly websiteUrl: string;
  readonly coverUrl: string;
  readonly avatarUrl: string;
  readonly coverAssetId: string | null;
  readonly avatarAssetId: string | null;
  readonly skills: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;

  private constructor(props: {
    userId: string;
    displayName: string;
    headline: string;
    bio: string;
    region: string;
    organisation: string;
    role: Role;
    phone: string;
    telegram: string;
    publicEmail: string;
    vkUrl: string;
    websiteUrl: string;
    coverUrl: string;
    avatarUrl: string;
    coverAssetId: string | null;
    avatarAssetId: string | null;
    skills: readonly string[];
    createdAt: string;
    updatedAt: string;
  }) {
    this.userId = props.userId;
    this.displayName = props.displayName;
    this.headline = props.headline;
    this.bio = props.bio;
    this.region = props.region;
    this.organisation = props.organisation;
    this.role = props.role;
    this.phone = props.phone;
    this.telegram = props.telegram;
    this.publicEmail = props.publicEmail;
    this.vkUrl = props.vkUrl;
    this.websiteUrl = props.websiteUrl;
    this.coverUrl = props.coverUrl;
    this.avatarUrl = props.avatarUrl;
    this.coverAssetId = props.coverAssetId;
    this.avatarAssetId = props.avatarAssetId;
    this.skills = props.skills;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static parseImageSource(
    input: unknown,
    options: { maxLen: number; label: string }
  ): string {
    if (input === null || input === undefined) return '';
    if (typeof input !== 'string') {
      throw new ValidationError(`Некорректный формат изображения (${options.label}).`);
    }
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (trimmed.length > options.maxLen) {
      throw new ValidationError(
        `Размер изображения (${options.label}) превышает допустимый лимит.`
      );
    }
    if (/^\/src\/assets\/images\/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(trimmed)) {
      return trimmed;
    }
    if (/^\/media\/[a-zA-Z0-9_-]+$/i.test(trimmed)) {
      return trimmed;
    }
    if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
      return trimmed;
    }
    throw new ValidationError(
      `Для ${options.label} допустимы встроенные пресеты, файлы из Медиатеки или JPEG/PNG/WebP.`
    );
  }

  static parsePublicEmail(input: unknown): string {
    if (input === null || input === undefined) return '';
    if (typeof input !== 'string') {
      throw new ValidationError('Некорректный формат публичного email.');
    }
    const trimmed = input.trim();
    if (!trimmed) return '';
    return EmailAddress.create(trimmed).value;
  }

  static parseSocialLink(input: unknown): string {
    if (input === null || input === undefined) return '';
    if (typeof input !== 'string') {
      throw new ValidationError('Некорректный формат ссылки на соцсеть.');
    }
    const raw = SanitizedText.sanitizeRaw(input, 200);
    if (!raw) return '';
    const withScheme = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
    if (!/^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s<>"']*)?$/i.test(withScheme)) {
      throw new ValidationError(
        'Укажите корректную ссылку (например, https://vk.com/username или https://max.ru/...).'
      );
    }
    return withScheme;
  }

  /**
   * Creates the default profile for an account. Called lazily on first access
   * so registration stays a single-insert operation.
   */
  static createDefault(input: {
    userId: string;
    displayName: string;
    region: string;
    organisation: string;
    role: Role;
    phone?: string;
    telegram?: string;
    avatarUrl?: string;
  }): SocialProfile {
    const now = new Date().toISOString();
    return new SocialProfile({
      userId: input.userId,
      displayName: SanitizedText.sanitizeRaw(input.displayName, 120) || 'Участник',
      headline: '',
      bio: '',
      region: SanitizedText.sanitizeRaw(input.region, 80),
      organisation: SanitizedText.sanitizeRaw(input.organisation, 160),
      role: input.role,
      phone: input.phone ?? '',
      telegram: input.telegram ?? '',
      publicEmail: '',
      vkUrl: '',
      websiteUrl: '',
      coverUrl: '',
      avatarUrl: input.avatarUrl ?? '',
      coverAssetId: null,
      avatarAssetId: null,
      skills: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(props: {
    userId: string;
    displayName: string;
    headline: string;
    bio: string;
    region: string;
    organisation: string;
    role: Role;
    phone?: string;
    telegram?: string;
    publicEmail?: string;
    vkUrl?: string;
    websiteUrl: string;
    coverUrl?: string;
    avatarUrl?: string;
    coverAssetId: string | null;
    avatarAssetId: string | null;
    skills: string[];
    createdAt: string;
    updatedAt: string;
  }): SocialProfile {
    return new SocialProfile({
      ...props,
      phone: props.phone ?? '',
      telegram: props.telegram ?? '',
      publicEmail: props.publicEmail ?? '',
      vkUrl: props.vkUrl ?? '',
      coverUrl: props.coverUrl ?? '',
      avatarUrl: props.avatarUrl ?? '',
      skills: props.skills,
    });
  }

  update(input: UpdateSocialProfileInput): SocialProfile {
    const websiteRaw = SanitizedText.sanitizeRaw(input.websiteUrl, 200);
    // A website is only stored when it is a well-formed http(s) URL.
    const websiteUrl =
      input.websiteUrl === undefined
        ? this.websiteUrl
        : websiteRaw && /^https?:\/\/[^\s]+$/i.test(websiteRaw)
          ? websiteRaw
          : '';

    const displayName =
      input.displayName === undefined
        ? this.displayName
        : SanitizedText.create(input.displayName, {
            fieldLabel: 'Имя профиля',
            minLen: 2,
            maxLen: 120,
          }).value;

    const region =
      input.region === undefined
        ? this.region
        : SanitizedText.sanitizeRaw(input.region, 80);

    const organisation =
      input.organisation === undefined
        ? this.organisation
        : SanitizedText.sanitizeRaw(input.organisation, 160);

    const phone =
      input.phone === undefined ? this.phone : User.parsePhone(input.phone);

    const telegram =
      input.telegram === undefined ? this.telegram : User.parseTelegram(input.telegram);

    const publicEmail =
      input.publicEmail === undefined
        ? this.publicEmail
        : SocialProfile.parsePublicEmail(input.publicEmail);

    const vkUrl =
      input.vkUrl === undefined ? this.vkUrl : SocialProfile.parseSocialLink(input.vkUrl);

    const coverUrl =
      input.coverUrl === undefined
        ? this.coverUrl
        : SocialProfile.parseImageSource(input.coverUrl, {
            maxLen: COVER_DATA_URL_MAX,
            label: 'обложки',
          });

    const avatarUrl =
      input.avatarUrl === undefined
        ? this.avatarUrl
        : SocialProfile.parseImageSource(input.avatarUrl, {
            maxLen: AVATAR_DATA_URL_MAX,
            label: 'аватара',
          });

    return new SocialProfile({
      userId: this.userId,
      displayName,
      headline:
        input.headline === undefined
          ? this.headline
          : SanitizedText.sanitizeRaw(input.headline, HEADLINE_MAX),
      bio:
        input.bio === undefined ? this.bio : SanitizedText.sanitizeRaw(input.bio, BIO_MAX),
      region,
      organisation,
      role: this.role,
      phone,
      telegram,
      publicEmail,
      vkUrl,
      websiteUrl,
      coverUrl,
      avatarUrl,
      coverAssetId:
        input.coverAssetId === undefined
          ? this.coverAssetId
          : SanitizedText.sanitizeRaw(input.coverAssetId, 64) || null,
      avatarAssetId:
        input.avatarAssetId === undefined
          ? this.avatarAssetId
          : SanitizedText.sanitizeRaw(input.avatarAssetId, 64) || null,
      skills:
        input.skills === undefined
          ? this.skills
          : SocialProfile.normalizeSkills(input.skills),
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString(),
    });
  }

  private static normalizeSkills(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const seen = new Set<string>();
    for (const raw of input) {
      const skill = SanitizedText.sanitizeRaw(raw, 40);
      if (skill) seen.add(skill);
    }
    return [...seen].slice(0, 12);
  }

  toDTO(counts: {
    followerCount: number;
    followingCount: number;
    postCount: number;
    albumCount: number;
    isFollowedByMe: boolean;
  }): SocialProfileDTO {
    return {
      userId: this.userId,
      displayName: this.displayName,
      headline: this.headline,
      bio: this.bio,
      region: this.region,
      organisation: this.organisation,
      role: this.role,
      phone: this.phone,
      telegram: this.telegram,
      publicEmail: this.publicEmail,
      vkUrl: this.vkUrl,
      websiteUrl: this.websiteUrl,
      coverUrl: this.coverUrl,
      avatarUrl: this.avatarUrl,
      coverAssetId: this.coverAssetId,
      avatarAssetId: this.avatarAssetId,
      skills: [...this.skills],
      ...counts,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

/** One entry in the unified activity stream (posts, albums, follows). */
export interface ActivityItemDTO {
  id: string;
  type: 'post' | 'album' | 'comment' | 'follow';
  actorId: string;
  actorName: string;
  summary: string;
  targetId: string | null;
  createdAt: string;
}
