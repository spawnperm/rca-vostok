import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import {
  createLogger,
  parseLogFormat,
  parseLogLevel,
  type LogEntry,
} from '../src/infrastructure/logging/Logger.ts';
import { createRequestLoggerMiddleware } from '../src/infrastructure/http/RequestLogger.ts';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rca-logger-test-'));
}

function readLogEntries(filePath: string): LogEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8').trim();
  if (!raw) return [];
  return raw.split('\n').map((line) => JSON.parse(line) as LogEntry);
}

test('Logger: writes DEBUG, INFO and ERROR records to file when level is DEBUG', async () => {
  const dir = makeTempDir();
  try {
    const logger = createLogger({
      level: 'DEBUG',
      logDir: dir,
      fileName: 'test.log',
      logToConsole: false,
      context: 'server',
    });

    logger.debug('Debug trace', { step: 1 });
    logger.info('Server started', { port: 3000 });
    logger.error('Request failed', new Error('db unreachable'));
    await logger.flush();

    const entries = readLogEntries(logger.getLogFilePath()!);
    assert.equal(entries.length, 3);
    assert.deepEqual(
      entries.map((e) => e.level),
      ['DEBUG', 'INFO', 'ERROR']
    );
    assert.equal(entries[0].context, 'server');
    assert.equal(entries[1].message, 'Server started');
    assert.equal((entries[2].meta?.error as { message: string }).message, 'db unreachable');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Logger: filters out DEBUG when level is INFO and keeps only ERROR when level is ERROR', async () => {
  const dir = makeTempDir();
  try {
    const infoLogger = createLogger({
      level: 'INFO',
      logDir: dir,
      fileName: 'info.log',
      logToConsole: false,
    });
    infoLogger.debug('hidden debug');
    infoLogger.info('visible info');
    infoLogger.error('visible error');
    await infoLogger.flush();

    const infoEntries = readLogEntries(infoLogger.getLogFilePath()!);
    assert.deepEqual(
      infoEntries.map((e) => e.level),
      ['INFO', 'ERROR']
    );

    const errLogger = createLogger({
      level: 'ERROR',
      logDir: dir,
      fileName: 'error.log',
      logToConsole: false,
    });
    errLogger.debug('hidden debug');
    errLogger.info('hidden info');
    errLogger.error('visible error');
    await errLogger.flush();

    const errEntries = readLogEntries(errLogger.getLogFilePath()!);
    assert.deepEqual(
      errEntries.map((e) => e.level),
      ['ERROR']
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Logger: child loggers inherit sink and compose context hierarchy', async () => {
  const dir = makeTempDir();
  try {
    const root = createLogger({
      level: 'DEBUG',
      logDir: dir,
      fileName: 'child.log',
      logToConsole: false,
      context: 'app',
    });

    const child = root.child('http').child('auth');
    child.info('Session validated', { userId: 'usr-1' });
    await child.flush();

    const entries = readLogEntries(root.getLogFilePath()!);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].context, 'app:http:auth');
    assert.equal(entries[0].meta?.userId, 'usr-1');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Logger: redacts sensitive keys recursively', async () => {
  const dir = makeTempDir();
  try {
    const logger = createLogger({
      level: 'DEBUG',
      logDir: dir,
      fileName: 'redact.log',
      logToConsole: false,
    });

    logger.info('Auth attempt', {
      email: 'user@example.com',
      password: 'super-secret-password',
      nested: {
        sessionToken: 'tok-123',
        api_key: 'key-xyz',
        region: 'Приморский край',
      },
    });
    await logger.flush();

    const entries = readLogEntries(logger.getLogFilePath()!);
    assert.equal(entries[0].meta?.password, '[REDACTED]');
    const nested = entries[0].meta?.nested as Record<string, unknown>;
    assert.equal(nested.sessionToken, '[REDACTED]');
    assert.equal(nested.api_key, '[REDACTED]');
    assert.equal(nested.region, 'Приморский край');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Logger: rotates log files when maxFileSizeBytes is exceeded', async () => {
  const dir = makeTempDir();
  try {
    const logger = createLogger({
      level: 'INFO',
      logDir: dir,
      fileName: 'rotate.log',
      logToConsole: false,
      maxFileSizeBytes: 1024,
      maxFiles: 2,
    });

    for (let i = 0; i < 25; i += 1) {
      logger.info(`Log rotation event number ${i}`, {
        payload: 'x'.repeat(80),
      });
    }
    await logger.flush();

    assert.ok(fs.existsSync(path.join(dir, 'rotate.log')));
    assert.ok(fs.existsSync(path.join(dir, 'rotate.log.1')));
    assert.ok(fs.existsSync(path.join(dir, 'rotate.log.2')));
    assert.equal(fs.existsSync(path.join(dir, 'rotate.log.3')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Logger: parseLogLevel and parseLogFormat normalize inputs safely', () => {
  assert.equal(parseLogLevel('debug'), 'DEBUG');
  assert.equal(parseLogLevel(' INFO '), 'INFO');
  assert.equal(parseLogLevel('error'), 'ERROR');
  assert.equal(parseLogLevel('warn', 'INFO'), 'INFO');
  assert.equal(parseLogFormat('PRETTY'), 'pretty');
  assert.equal(parseLogFormat('invalid', 'json'), 'json');
});

test('RequestLogger: logs API at INFO, static at DEBUG, and 5xx at ERROR with X-Request-Id', async () => {
  const dir = makeTempDir();
  try {
    const logger = createLogger({
      level: 'DEBUG',
      logDir: dir,
      fileName: 'http.log',
      logToConsole: false,
    });
    const middleware = createRequestLoggerMiddleware(logger);

    const runRequest = (method: string, reqPath: string, statusCode: number, reqId?: string) => {
      const req = {
        method,
        path: reqPath,
        headers: reqId ? { 'x-request-id': reqId } : {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Parameters<typeof middleware>[0];

      const resHeaders: Record<string, string> = {};
      const res = Object.assign(new EventEmitter(), {
        statusCode,
        setHeader(name: string, val: string) {
          resHeaders[name] = val;
        },
      }) as unknown as Parameters<typeof middleware>[1];

      middleware(req, res, () => {
        (res as unknown as EventEmitter).emit('finish');
      });

      return resHeaders['X-Request-Id'];
    };

    const id1 = runRequest('GET', '/api/health', 200, 'req-custom-1');
    const id2 = runRequest('GET', '/assets/app.js', 200);
    const id3 = runRequest('POST', '/api/inquiries', 500);
    await logger.flush();

    assert.equal(id1, 'req-custom-1');
    assert.ok(id2 && id2.length > 0);
    assert.ok(id3 && id3.length > 0);

    const entries = readLogEntries(logger.getLogFilePath()!);
    assert.deepEqual(
      entries.map((e) => e.level),
      ['INFO', 'DEBUG', 'ERROR']
    );
    assert.equal(entries[0].meta?.requestId, 'req-custom-1');
    assert.equal(entries[2].meta?.status, 500);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
