/**
 * Unified browser file download helpers.
 * Consolidates repeated Blob + ObjectURL + temporary anchor cleanup logic.
 */

export function downloadBlobFile(blob: Blob, fileName: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('Скачивание файлов доступно только в браузере.');
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadTextFile(
  content: string,
  fileName: string,
  mimeType = 'text/plain;charset=utf-8'
): { fileName: string; byteSize: number } {
  const blob = new Blob([content], { type: mimeType });
  downloadBlobFile(blob, fileName);
  return { fileName, byteSize: blob.size };
}

export function downloadJsonFile(
  data: unknown,
  fileName: string,
  pretty = true
): { fileName: string; jsonContent: string; byteSize: number } {
  const jsonContent =
    typeof data === 'string'
      ? data
      : JSON.stringify(data, null, pretty ? 2 : undefined);
  const { byteSize } = downloadTextFile(
    jsonContent,
    fileName,
    'application/json;charset=utf-8'
  );
  return { fileName, jsonContent, byteSize };
}
