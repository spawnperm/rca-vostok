import fs from 'fs';
import path from 'path';
import { resolveConfinedPath } from '../persistence/PathConfinement.ts';

/**
 * Structured application logger with level filtering (DEBUG, INFO, ERROR),
 * secret redaction, size-based log file rotation and console output.
 *
 * Uses pure Node.js built-ins and avoids TypeScript `enum` / parameter
 * properties so `node server.ts` (Node >= 22.18 native type stripping) executes
 * it directly without a compile step.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'ERROR';
export type LogFormat = 'json' | 'pretty';

export const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  ERROR: 30,
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface LoggerOptions {
  level?: LogLevel;
  format?: LogFormat;
  logToConsole?: boolean;
  logToFile?: boolean;
  logDir?: string;
  fileName?: string;
  maxFileSizeBytes?: number;
  maxFiles?: number;
  context?: string;
}

export interface Logger {
  readonly level: LogLevel;
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, metaOrError?: Record<string, unknown> | unknown): void;
  child(context: string): Logger;
  flush(): Promise<void>;
  getLogFilePath(): string | null;
}

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB
const DEFAULT_MAX_FILES = 5;

const SENSITIVE_KEY_PATTERN =
  /pass(word)?|secret|token|cookie|authorization|api[_-]?key|credential/i;

export function parseLogLevel(raw?: string | null, fallback: LogLevel = 'INFO'): LogLevel {
  if (!raw) return fallback;
  const normalized = raw.trim().toUpperCase();
  if (normalized === 'DEBUG' || normalized === 'INFO' || normalized === 'ERROR') {
    return normalized;
  }
  return fallback;
}

export function parseLogFormat(raw?: string | null, fallback: LogFormat = 'json'): LogFormat {
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'json' || normalized === 'pretty') {
    return normalized;
  }
  return fallback;
}

function serializeValue(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') return value.toString();

  if (value instanceof Error) {
    const out: Record<string, unknown> = {
      name: value.name,
      message: value.message,
    };
    const withCode = value as Error & { code?: unknown };
    if (withCode.code !== undefined) {
      out.code = withCode.code;
    }
    if (value.stack) {
      out.stack = value.stack;
    }
    return out;
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    if (depth >= 5) return '[MaxDepth]';
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => serializeValue(item, seen, depth + 1));
    }

    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = serializeValue(v, seen, depth + 1);
      }
    }
    return result;
  }

  return String(value);
}

function normalizeMeta(metaOrError?: Record<string, unknown> | unknown): Record<string, unknown> | undefined {
  if (metaOrError === undefined || metaOrError === null) return undefined;
  if (
    typeof metaOrError === 'object' &&
    !(metaOrError instanceof Error) &&
    !Array.isArray(metaOrError)
  ) {
    const serialized = serializeValue(metaOrError) as Record<string, unknown>;
    return Object.keys(serialized).length > 0 ? serialized : undefined;
  }
  return { error: serializeValue(metaOrError) };
}

function sanitizeInline(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').trim();
}

function formatPretty(entry: LogEntry): string {
  const paddedLevel = entry.level.padEnd(5, ' ');
  const ctx = entry.context ? ` [${sanitizeInline(entry.context)}]` : '';
  const msg = sanitizeInline(entry.message);
  const metaSuffix = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
  return `[${entry.timestamp}] ${paddedLevel}${ctx} ${msg}${metaSuffix}`;
}

class FileLogSink {
  private readonly logDir: string;
  private readonly fileName: string;
  private readonly filePath: string;
  private readonly maxFileSizeBytes: number;
  private readonly maxFiles: number;
  private writeQueue: Promise<void> = Promise.resolve();
  private dirReady = false;
  private writeErrorReported = false;

  constructor(options: {
    logDir: string;
    fileName: string;
    maxFileSizeBytes: number;
    maxFiles: number;
  }) {
    this.logDir = path.resolve(options.logDir);
    this.fileName = path.basename(options.fileName) || 'rca-vostok.log';
    this.filePath = resolveConfinedPath(this.logDir, this.fileName);
    this.maxFileSizeBytes = Math.max(1024, options.maxFileSizeBytes);
    this.maxFiles = Math.max(1, options.maxFiles);
  }

  getFilePath(): string {
    return this.filePath;
  }

  enqueue(line: string): void {
    this.writeQueue = this.writeQueue
      .then(() => this.appendLine(line))
      .catch((err) => {
        if (!this.writeErrorReported) {
          this.writeErrorReported = true;
          process.stderr.write(
            `[logger] failed to write log file "${this.filePath}": ${
              err instanceof Error ? err.message : String(err)
            }\n`
          );
        }
      });
  }

  flush(): Promise<void> {
    return this.writeQueue;
  }

  private async ensureDir(): Promise<void> {
    if (this.dirReady) return;
    await fs.promises.mkdir(this.logDir, { recursive: true });
    this.dirReady = true;
  }

  private async appendLine(line: string): Promise<void> {
    await this.ensureDir();
    const payload = `${line}\n`;
    const incomingBytes = Buffer.byteLength(payload, 'utf-8');

    try {
      const stat = await fs.promises.stat(this.filePath);
      if (stat.size + incomingBytes > this.maxFileSizeBytes) {
        await this.rotate();
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw err;
      }
    }

    await fs.promises.appendFile(this.filePath, payload, 'utf-8');
  }

  private async rotate(): Promise<void> {
    const oldest = resolveConfinedPath(this.logDir, `${this.fileName}.${this.maxFiles}`);
    await fs.promises.rm(oldest, { force: true });

    for (let i = this.maxFiles - 1; i >= 1; i -= 1) {
      const src = resolveConfinedPath(this.logDir, `${this.fileName}.${i}`);
      const dst = resolveConfinedPath(this.logDir, `${this.fileName}.${i + 1}`);
      try {
        await fs.promises.rename(src, dst);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err;
        }
      }
    }

    const firstArchive = resolveConfinedPath(this.logDir, `${this.fileName}.1`);
    try {
      await fs.promises.rename(this.filePath, firstArchive);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }
}

class StructuredLogger implements Logger {
  readonly level: LogLevel;
  private readonly format: LogFormat;
  private readonly logToConsole: boolean;
  private readonly context: string;
  private readonly sink: FileLogSink | null;

  constructor(options: {
    level: LogLevel;
    format: LogFormat;
    logToConsole: boolean;
    context: string;
    sink: FileLogSink | null;
  }) {
    this.level = options.level;
    this.format = options.format;
    this.logToConsole = options.logToConsole;
    this.context = options.context;
    this.sink = options.sink;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('DEBUG', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('INFO', message, meta);
  }

  error(message: string, metaOrError?: Record<string, unknown> | unknown): void {
    this.write('ERROR', message, metaOrError);
  }

  child(context: string): Logger {
    const nextContext = this.context ? `${this.context}:${context}` : context;
    return new StructuredLogger({
      level: this.level,
      format: this.format,
      logToConsole: this.logToConsole,
      context: nextContext,
      sink: this.sink,
    });
  }

  flush(): Promise<void> {
    return this.sink ? this.sink.flush() : Promise.resolve();
  }

  getLogFilePath(): string | null {
    return this.sink ? this.sink.getFilePath() : null;
  }

  private write(
    level: LogLevel,
    message: string,
    metaOrError?: Record<string, unknown> | unknown
  ): void {
    if (LOG_LEVEL_WEIGHT[level] < LOG_LEVEL_WEIGHT[this.level]) {
      return;
    }

    const meta = normalizeMeta(metaOrError);
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context || 'app',
      message,
      ...(meta ? { meta } : {}),
    };

    const jsonLine = JSON.stringify(entry);

    if (this.sink) {
      this.sink.enqueue(jsonLine);
    }

    if (this.logToConsole) {
      const consoleLine = this.format === 'pretty' ? formatPretty(entry) : jsonLine;
      if (level === 'ERROR') {
        console.error(consoleLine);
      } else if (level === 'DEBUG') {
        console.debug(consoleLine);
      } else {
        console.info(consoleLine);
      }
    }
  }
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const isProd = process.env.NODE_ENV === 'production';
  const level = options.level ?? (isProd ? 'INFO' : 'DEBUG');
  const format = options.format ?? (isProd ? 'json' : 'pretty');
  const logToConsole = options.logToConsole ?? true;
  const logToFile = options.logToFile ?? true;
  const logDir = options.logDir ?? path.resolve(process.cwd(), 'logs');
  const fileName = options.fileName ?? 'rca-vostok.log';
  const maxFileSizeBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;

  const sink = logToFile
    ? new FileLogSink({
        logDir,
        fileName,
        maxFileSizeBytes,
        maxFiles,
      })
    : null;

  return new StructuredLogger({
    level,
    format,
    logToConsole,
    context: options.context ?? 'app',
    sink,
  });
}

export function createLoggerFromEnv(overrides: LoggerOptions = {}): Logger {
  const isProd = process.env.NODE_ENV === 'production';
  const isTestRunner =
    Boolean(process.env.NODE_TEST_CONTEXT) ||
    process.argv.some((arg) => arg.includes('--test'));

  const level = overrides.level ?? parseLogLevel(process.env.LOG_LEVEL, isProd ? 'INFO' : 'DEBUG');
  const format = overrides.format ?? parseLogFormat(process.env.LOG_FORMAT, isProd ? 'json' : 'pretty');

  const envLogToFile = process.env.LOG_TO_FILE;
  const logToFile =
    overrides.logToFile ??
    (envLogToFile !== undefined ? envLogToFile.trim().toLowerCase() !== 'false' : !isTestRunner);

  const maxMbRaw = Number(process.env.LOG_MAX_SIZE_MB);
  const maxFileSizeBytes =
    overrides.maxFileSizeBytes ??
    (Number.isFinite(maxMbRaw) && maxMbRaw > 0
      ? Math.round(maxMbRaw * 1024 * 1024)
      : DEFAULT_MAX_FILE_SIZE_BYTES);

  const maxFilesRaw = Number(process.env.LOG_MAX_FILES);
  const maxFiles =
    overrides.maxFiles ??
    (Number.isFinite(maxFilesRaw) && maxFilesRaw >= 1
      ? Math.floor(maxFilesRaw)
      : DEFAULT_MAX_FILES);

  return createLogger({
    level,
    format,
    logToConsole: overrides.logToConsole ?? true,
    logToFile,
    logDir: overrides.logDir ?? (process.env.LOG_DIR?.trim() || path.resolve(process.cwd(), 'logs')),
    fileName: overrides.fileName ?? (process.env.LOG_FILE?.trim() || 'rca-vostok.log'),
    maxFileSizeBytes,
    maxFiles,
    context: overrides.context ?? 'app',
  });
}

/** Shared application logger configured from process environment variables. */
export const appLogger: Logger = createLoggerFromEnv();
