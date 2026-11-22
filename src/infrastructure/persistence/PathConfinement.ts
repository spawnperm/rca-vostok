import fs from 'fs';
import path from 'path';

export function resolveConfinedPath(baseDir: string, fileName: string): string {
  const normalizedBase = path.resolve(baseDir);
  const resolved = path.resolve(normalizedBase, fileName);
  if (!resolved.startsWith(normalizedBase + path.sep)) {
    throw new Error(`Path confinement violation for ${fileName}`);
  }
  return resolved;
}

export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function atomicWriteJson(
  baseDir: string,
  targetFileName: string,
  tempFileName: string,
  payload: unknown
): void {
  ensureDirectory(baseDir);
  const targetPath = resolveConfinedPath(baseDir, targetFileName);
  const tempPath = resolveConfinedPath(baseDir, tempFileName);
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
  fs.renameSync(tempPath, targetPath);
}
