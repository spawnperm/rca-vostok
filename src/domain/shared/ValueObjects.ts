import { ValidationError } from './DomainError.ts';

export class SanitizedText {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static sanitizeRaw(input: unknown, maxLen: number): string {
    if (typeof input !== 'string') return '';
    return input.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);
  }

  static create(
    input: unknown,
    options: { fieldLabel: string; minLen?: number; maxLen: number }
  ): SanitizedText {
    const cleaned = SanitizedText.sanitizeRaw(input, options.maxLen);
    if (options.minLen && cleaned.length < options.minLen) {
      throw new ValidationError(
        `Поле «${options.fieldLabel}» должно содержать не менее ${options.minLen} символов.`
      );
    }
    return new SanitizedText(cleaned);
  }

  /**
   * Rebuilds a value object from already-validated persistence data.
   * Unlike `create`, it does not re-run field rules: aggregates restored from
   * the database must not fail on historical rows that predate a rule change.
   */
  static rehydrate(value: string): SanitizedText {
    return new SanitizedText(value);
  }
}

export class EmailAddress {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(input: unknown): EmailAddress {
    const cleaned = SanitizedText.sanitizeRaw(input, 160).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned)) {
      throw new ValidationError('Укажите корректный адрес электронной почты.');
    }
    return new EmailAddress(cleaned);
  }

  /** Rebuilds an address already validated when it was persisted. */
  static rehydrate(value: string): EmailAddress {
    return new EmailAddress(value);
  }
}

export class BoundedNumber {
  readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  static clampOrUndefined(input: unknown, min: number, max: number): number | undefined {
    if (typeof input !== 'number' || !Number.isFinite(input)) return undefined;
    return Math.min(Math.max(Math.round(input * 10) / 10, min), max);
  }

  static create(
    input: unknown,
    options: { fieldLabel: string; min: number; max: number }
  ): BoundedNumber {
    if (typeof input !== 'number' || !Number.isFinite(input)) {
      throw new ValidationError(`Параметр «${options.fieldLabel}» должен быть числом.`);
    }
    if (input < options.min || input > options.max) {
      throw new ValidationError(
        `Параметр «${options.fieldLabel}» должен находиться в диапазоне от ${options.min} до ${options.max}.`
      );
    }
    return new BoundedNumber(input);
  }
}
