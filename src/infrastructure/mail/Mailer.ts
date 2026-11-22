import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { Mailer, MailMessage } from '../../domain/identity/PasswordReset.ts';

/**
 * Mail transports.
 *
 * `SmtpMailer` is used when SMTP credentials are configured; otherwise the
 * composition root falls back to `LoggingMailer`.
 */

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
}

export class SmtpMailer implements Mailer {
  readonly delivers = true;
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: SmtpConfig) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user
        ? { user: config.user, pass: config.password ?? '' }
        : undefined,
    });
  }

  async send(message: MailMessage): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return true;
    } catch (err) {
      console.error('[mail] delivery failed', err instanceof Error ? err.message : err);
      return false;
    }
  }
}

/**
 * Development/fallback transport: logs the message instead of delivering it.
 *
 * This is deliberately honest rather than silently pretending success — the
 * API reports `delivered: false` so the caller knows the user will not receive
 * an email, and the reset link is written to the server log for local testing.
 */
export class LoggingMailer implements Mailer {
  readonly delivers = false;

  async send(message: MailMessage): Promise<boolean> {
    console.info(
      JSON.stringify({
        level: 'info',
        kind: 'mail-not-sent',
        reason: 'no SMTP transport configured',
        to: message.to,
        subject: message.subject,
        // The body contains the reset link, so it is logged only here, never
        // returned by the API.
        text: message.text,
      })
    );
    return false;
  }
}

/** Builds an SMTP mailer from the environment, or null when unconfigured. */
export function createMailerFromEnv(): Mailer | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return new SmtpMailer({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM ?? 'РЦА «Русский Восток» <no-reply@rca-vostok.ru>',
  });
}
