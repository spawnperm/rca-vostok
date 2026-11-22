import type pg from 'pg';
import { User } from '../../../domain/identity/User.ts';
import type { UserRepository } from '../../../domain/identity/IdentityRepositories.ts';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  region: string;
  organisation: string;
  role: string;
  password_hash: string;
  password_salt: string;
  is_active: boolean;
  created_at: Date;
  last_login_at: Date | null;
}

function toAggregate(row: UserRow): User {
  return User.rehydrate({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    region: row.region,
    organisation: row.organisation,
    role: row.role,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
  });
}

/** PostgreSQL adapter for the identity bounded context. */
export class PostgresUserRepository implements UserRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? toAggregate(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      'SELECT * FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    return result.rows.length > 0 ? toAggregate(result.rows[0]) : null;
  }

  async save(user: User): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (
         id, email, full_name, region, organisation, role,
         password_hash, password_salt, is_active, created_at, last_login_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         full_name = EXCLUDED.full_name,
         region = EXCLUDED.region,
         organisation = EXCLUDED.organisation,
         role = EXCLUDED.role,
         password_hash = EXCLUDED.password_hash,
         password_salt = EXCLUDED.password_salt,
         is_active = EXCLUDED.is_active,
         last_login_at = EXCLUDED.last_login_at`,
      [
        user.id,
        user.email.value,
        user.fullName.value,
        user.region,
        user.organisation,
        user.role,
        user.passwordHash,
        user.passwordSalt,
        user.isActive,
        user.createdAt,
        user.lastLoginAt,
      ]
    );
  }

  async listAll(): Promise<User[]> {
    const result = await this.pool.query<UserRow>(
      'SELECT * FROM users ORDER BY created_at ASC'
    );
    return result.rows.map(toAggregate);
  }

  async count(): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM users'
    );
    return Number(result.rows[0]?.count ?? 0);
  }
}
