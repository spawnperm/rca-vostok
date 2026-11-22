import type { User } from '../../domain/identity/User.ts';
import type {
  SessionRecord,
  SessionRepository,
  UserRepository,
} from '../../domain/identity/IdentityRepositories.ts';

/**
 * In-memory adapters used when no database is configured (local development)
 * and by unit tests. State is process-local and intentionally not persisted.
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const needle = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.value === needle) return user;
    }
    return null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async listAll(): Promise<User[]> {
    return [...this.users.values()].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  async count(): Promise<number> {
    return this.users.size;
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, SessionRecord>();

  async create(session: SessionRecord): Promise<void> {
    this.sessions.set(session.tokenHash, session);
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async deleteByUserId(userId: string): Promise<void> {
    for (const [hash, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(hash);
    }
  }

  async purgeExpired(now: string): Promise<number> {
    let removed = 0;
    for (const [hash, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(hash);
        removed += 1;
      }
    }
    return removed;
  }
}
