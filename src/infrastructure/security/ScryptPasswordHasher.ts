import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { PasswordHasher } from '../../application/identity/SecurityPorts.ts';

const scrypt = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number
) => Promise<Buffer>;

/** scrypt cost parameters. N=16384 keeps verification ~50-80ms on 2 vCPU. */
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/**
 * scrypt-based password hasher (Node built-in, no native dependencies).
 *
 * scrypt is memory-hard, so a leaked hash is expensive to brute-force, and it
 * ships with Node — unlike bcrypt/argon2 it needs no compiler in the image.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plainPassword: string): Promise<{ passwordHash: string; passwordSalt: string }> {
    const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
    const derived = await scrypt(plainPassword, salt, KEY_LENGTH);
    return {
      passwordHash: derived.toString('hex'),
      passwordSalt: salt,
    };
  }

  async verify(
    plainPassword: string,
    material: { passwordHash: string; passwordSalt: string }
  ): Promise<boolean> {
    if (!material.passwordHash || !material.passwordSalt) {
      return false;
    }
    try {
      const derived = await scrypt(plainPassword, material.passwordSalt, KEY_LENGTH);
      const expected = Buffer.from(material.passwordHash, 'hex');
      // Length check is required: timingSafeEqual throws on size mismatch.
      if (expected.length !== derived.length) {
        return false;
      }
      return crypto.timingSafeEqual(expected, derived);
    } catch {
      return false;
    }
  }
}

/**
 * Issues opaque session tokens. The client receives the raw value in an
 * HttpOnly cookie; only its SHA-256 hash is persisted, so a database leak
 * cannot be replayed as a valid session.
 */
export class Sha256SessionTokenService {
  issue(): { token: string; tokenHash: string } {
    const token = crypto.randomBytes(32).toString('base64url');
    return { token, tokenHash: this.hashToken(token) };
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
