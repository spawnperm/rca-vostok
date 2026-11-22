import { SanitizedText } from '../shared/ValueObjects.ts';
import type { Role } from '../identity/Rbac.ts';

/**
 * Extended social profile that sits beside the identity aggregate.
 *
 * Identity owns credentials and RBAC; this context owns presentation and
 * relationships (bio, cover, follower graph, activity counters). Splitting
 * them keeps the security-critical aggregate small.
 */

export interface SocialProfileDTO {
  userId: string;
  displayName: string;
  headline: string;
  bio: string;
  region: string;
  organisation: string;
  role: Role;
  websiteUrl: string;
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
  headline?: unknown;
  bio?: unknown;
  websiteUrl?: unknown;
  coverAssetId?: unknown;
  avatarAssetId?: unknown;
  skills?: unknown;
}

export const BIO_MAX = 1200;
export const HEADLINE_MAX = 140;

export class SocialProfile {
  readonly userId: string;
  readonly displayName: string;
  readonly headline: string;
  readonly bio: string;
  readonly region: string;
  readonly organisation: string;
  readonly role: Role;
  readonly websiteUrl: string;
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
    websiteUrl: string;
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
    this.websiteUrl = props.websiteUrl;
    this.coverAssetId = props.coverAssetId;
    this.avatarAssetId = props.avatarAssetId;
    this.skills = props.skills;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
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
      websiteUrl: '',
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
    websiteUrl: string;
    coverAssetId: string | null;
    avatarAssetId: string | null;
    skills: string[];
    createdAt: string;
    updatedAt: string;
  }): SocialProfile {
    return new SocialProfile({ ...props, skills: props.skills });
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

    return new SocialProfile({
      userId: this.userId,
      displayName: this.displayName,
      headline:
        input.headline === undefined
          ? this.headline
          : SanitizedText.sanitizeRaw(input.headline, HEADLINE_MAX),
      bio:
        input.bio === undefined ? this.bio : SanitizedText.sanitizeRaw(input.bio, BIO_MAX),
      region: this.region,
      organisation: this.organisation,
      role: this.role,
      websiteUrl,
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
      websiteUrl: this.websiteUrl,
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
