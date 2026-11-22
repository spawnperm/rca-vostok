/**
 * Creates or promotes a platform administrator.
 *
 * Uses the real domain aggregate and the real password hasher, so the stored
 * credentials are byte-for-byte what the login flow expects. Idempotent: if the
 * account already exists its password is reset and the role forced to admin.
 *
 * The payload arrives on stdin so the password never appears in the process
 * list, shell history, or container logs:
 *
 *   node scripts/create-admin.ts <<'JSON'
 *   {"fullName":"...","email":"...","password":"...","region":"..."}
 *   JSON
 */
import { ROLES } from '../src/domain/identity/Rbac.ts';
import { User } from '../src/domain/identity/User.ts';
import { PostgresUserRepository } from '../src/infrastructure/persistence/pg/PostgresUserRepository.ts';
import { createPool, runMigrations } from '../src/infrastructure/persistence/pg/PostgresPool.ts';
import { ScryptPasswordHasher } from '../src/infrastructure/security/ScryptPasswordHasher.ts';

interface Payload {
  fullName: string;
  email: string;
  password: string;
  region?: string;
  organisation?: string;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

function parsePayload(raw: string): Payload {
  if (!raw) {
    throw new Error('Пустой ввод: ожидается JSON с fullName, email и password.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Ввод не является корректным JSON.');
  }

  const input = parsed as Partial<Payload>;
  if (!input.fullName || !input.email || !input.password) {
    throw new Error('Обязательны поля fullName, email и password.');
  }
  return {
    fullName: String(input.fullName),
    email: String(input.email),
    password: String(input.password),
    region: input.region ? String(input.region) : undefined,
    organisation: input.organisation ? String(input.organisation) : undefined,
  };
}

async function main(): Promise<void> {
  const payload = parsePayload(await readStdin());

  const pool = createPool();
  if (!pool) {
    throw new Error('База данных не сконфигурирована (нужен DATABASE_URL или PG*).');
  }

  try {
    await runMigrations(pool);

    const users = new PostgresUserRepository(pool);
    const hasher = new ScryptPasswordHasher();

    const existing = await users.findByEmail(payload.email.trim().toLowerCase());

    let user: User;
    if (existing) {
      // Reset the password, refresh the display name, then guarantee admin.
      const material = await hasher.hash(payload.password);
      user = existing
        .withPassword(material)
        .setActive(true)
        .updateProfile({ fullName: payload.fullName })
        .changeRole(ROLES.ADMIN);
      console.info(`[admin] existing account updated: ${user.email.value}`);
    } else {
      // User.create validates the password policy and the email format.
      const draft = User.create({
        email: payload.email,
        password: payload.password,
        fullName: payload.fullName,
        region: payload.region,
        organisation: payload.organisation,
        role: ROLES.ADMIN,
      });
      const material = await hasher.hash(draft.plainPassword);
      user = draft.withPassword(material);
      console.info(`[admin] account created: ${user.email.value}`);
    }

    await users.save(user);

    // Report the resulting state without ever echoing the password.
    const dto = user.toDTO();
    console.info(
      JSON.stringify({
        id: dto.id,
        email: dto.email,
        fullName: dto.fullName,
        role: dto.role,
        isActive: dto.isActive,
        permissions: dto.permissions.length,
      })
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('[admin] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
