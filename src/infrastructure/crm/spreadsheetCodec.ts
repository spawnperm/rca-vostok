import JSZip from 'jszip';
import { colIndexToLetter } from '../../domain/office/entities.ts';

export type SpreadsheetFormat = 'csv' | 'xlsx';

export interface SpreadsheetColumn {
  key: string;
  label: string;
}

export interface ParsedSpreadsheet {
  format: SpreadsheetFormat;
  headers: string[];
  rows: Record<string, string>[];
}

export const SPREADSHEET_MIME_TYPES: Record<SpreadsheetFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const MAX_DECODED_BYTES = 5 * 1024 * 1024; // 5 MB safety limit
const MAX_IMPORT_ROWS = 5000;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str: string): string {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/**
 * Neutralizes spreadsheet formula injection (=, +, -, @, tab, CR) on text cells.
 * Negative numbers passed as JS `number` bypass text prefixing so numeric totals stay numeric.
 */
export function sanitizeSpreadsheetText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw);
  if (str.length === 0) return '';
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function sanitizeCsvCell(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  const safe = sanitizeSpreadsheetText(raw);
  if (/[",\r\n;]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildCsvBuffer(
  columns: SpreadsheetColumn[],
  rows: Array<Record<string, unknown>>
): Buffer {
  const headerLine = columns.map((c) => sanitizeCsvCell(c.label)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((c) => sanitizeCsvCell(row[c.key] ?? '')).join(',')
  );
  const content = `\uFEFF${[headerLine, ...dataLines].join('\r\n')}`;
  return Buffer.from(content, 'utf-8');
}

export async function buildXlsxBuffer(
  sheetName: string,
  columns: SpreadsheetColumn[],
  rows: Array<Record<string, unknown>>
): Promise<Buffer> {
  const zip = new JSZip();
  const safeSheetName = (sheetName || 'Export')
    .replace(/[\\/?*[\]:]/g, ' ')
    .trim()
    .slice(0, 31) || 'Export';

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(safeSheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
  </fills>
  <borders count="1"><border/></borders>
  <cellXfs count="2">
    <xf fontId="0" fillId="0" borderId="0"/>
    <xf fontId="1" fillId="1" borderId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`
  );

  const headerCells = columns
    .map((col, colIdx) => {
      const ref = `${colIndexToLetter(colIdx)}1`;
      return `<c r="${ref}" t="inlineStr" s="1"><is><t>${escapeXml(sanitizeSpreadsheetText(col.label))}</t></is></c>`;
    })
    .join('');
  const headerRowXml = `<row r="1">${headerCells}</row>`;

  const bodyRowsXml = rows
    .map((row, rowIdx) => {
      const excelRowNum = rowIdx + 2;
      const cellsXml = columns
        .map((col, colIdx) => {
          const ref = `${colIndexToLetter(colIdx)}${excelRowNum}`;
          const val = row[col.key];
          if (typeof val === 'number' && Number.isFinite(val)) {
            return `<c r="${ref}"><v>${val}</v></c>`;
          }
          if (typeof val === 'boolean') {
            return `<c r="${ref}" t="inlineStr"><is><t>${val ? 'Да' : 'Нет'}</t></is></c>`;
          }
          const text = sanitizeSpreadsheetText(
            Array.isArray(val) ? val.join(', ') : val ?? ''
          );
          if (!text) {
            return `<c r="${ref}" t="inlineStr"><is><t></t></is></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
        })
        .join('');
      return `<row r="${excelRowNum}">${cellsXml}</row>`;
    })
    .join('');

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${headerRowXml}${bodyRowsXml}</sheetData>
</worksheet>`
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function detectCsvDelimiter(firstLine: string): ',' | ';' | '\t' {
  let inQuotes = false;
  let commas = 0;
  let semis = 0;
  let tabs = 0;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === ',') commas++;
      else if (ch === ';') semis++;
      else if (ch === '\t') tabs++;
    }
  }
  if (semis > commas && semis >= tabs) return ';';
  if (tabs > commas && tabs > semis) return '\t';
  return ',';
}

function normalizeHeaders(rawHeaders: string[]): string[] {
  const seen = new Map<string, number>();
  return rawHeaders.map((raw, idx) => {
    const base = raw.trim() || `Колонка ${idx + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

export function parseCsvBuffer(buffer: Buffer): ParsedSpreadsheet {
  let text = buffer.toString('utf-8');
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstNewline = normalized.indexOf('\n');
  const firstLine = firstNewline >= 0 ? normalized.slice(0, firstNewline) : normalized;
  const delimiter = detectCsvDelimiter(firstLine);

  const matrix: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      if (row.some((cell) => cell.trim() !== '')) {
        matrix.push(row);
      }
      row = [];
      field = '';
      if (matrix.length > MAX_IMPORT_ROWS + 1) {
        throw new Error(`Превышен лимит импорта (${MAX_IMPORT_ROWS} строк за один раз)`);
      }
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) {
      matrix.push(row);
    }
  }

  if (matrix.length === 0) {
    throw new Error('CSV-файл пуст или не содержит заголовков');
  }

  const headers = normalizeHeaders(matrix[0]);
  const rows = matrix.slice(1, MAX_IMPORT_ROWS + 1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? '').trim();
    });
    return obj;
  });

  return { format: 'csv', headers, rows };
}

function parseExcelCellRef(ref: string): { row: number; col: number } | null {
  const match = /^([A-Z]+)(\d+)$/i.exec(ref);
  if (!match) return null;
  const letters = match[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { row: parseInt(match[2], 10) - 1, col: col - 1 };
}

export async function parseXlsxBuffer(buffer: Buffer): Promise<ParsedSpreadsheet> {
  const zip = await JSZip.loadAsync(buffer);

  const sharedStrings: string[] = [];
  const ssFile = zip.file('xl/sharedStrings.xml');
  if (ssFile) {
    const ssXml = await ssFile.async('string');
    const siMatches = ssXml.match(/<si\b[^>]*>[\s\S]*?<\/si>/g) || [];
    for (const si of siMatches) {
      const texts = Array.from(si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((m) =>
        unescapeXml(m[1])
      );
      sharedStrings.push(texts.join(''));
    }
  }

  const sheetFiles = Object.keys(zip.files)
    .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const nb = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return na - nb;
    });

  if (sheetFiles.length === 0) {
    throw new Error('В Excel-файле (.xlsx) не найдено ни одного листа');
  }

  const sheetXml = await zip.file(sheetFiles[0])!.async('string');
  const rowsMap = new Map<number, Map<number, string>>();
  let maxCol = 0;
  let maxRow = 0;

  const cellMatches = sheetXml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g);
  for (const m of cellMatches) {
    const attrs = m[1];
    const inner = m[2] || '';
    const refMatch = /r="([A-Z]+\d+)"/i.exec(attrs);
    if (!refMatch) continue;
    const pos = parseExcelCellRef(refMatch[1]);
    if (!pos) continue;
    if (pos.row > MAX_IMPORT_ROWS) {
      throw new Error(`Превышен лимит импорта (${MAX_IMPORT_ROWS} строк за один раз)`);
    }

    const typeMatch = /t="([^"]+)"/.exec(attrs);
    const cellType = typeMatch ? typeMatch[1] : '';
    const valueMatch = /<v[^>]*>([\s\S]*?)<\/v>/.exec(inner);
    const inlineTexts = Array.from(inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((t) =>
      unescapeXml(t[1])
    );

    let textVal = '';
    if (cellType === 's' && valueMatch) {
      textVal = sharedStrings[Number(valueMatch[1])] ?? '';
    } else if (cellType === 'inlineStr' && inlineTexts.length > 0) {
      textVal = inlineTexts.join('');
    } else if (cellType === 'str' && valueMatch) {
      textVal = unescapeXml(valueMatch[1]);
    } else if (cellType === 'b' && valueMatch) {
      textVal = valueMatch[1].trim() === '1' ? 'Да' : 'Нет';
    } else if (valueMatch) {
      textVal = unescapeXml(valueMatch[1]).trim();
    }

    let colMap = rowsMap.get(pos.row);
    if (!colMap) {
      colMap = new Map<number, string>();
      rowsMap.set(pos.row, colMap);
    }
    colMap.set(pos.col, textVal.trim());
    if (pos.col > maxCol) maxCol = pos.col;
    if (pos.row > maxRow) maxRow = pos.row;
  }

  const rowIndices = Array.from(rowsMap.keys()).sort((a, b) => a - b);
  if (rowIndices.length === 0) {
    throw new Error('Лист Excel пуст');
  }

  const headerRowIdx = rowIndices[0];
  const headerCols = rowsMap.get(headerRowIdx) || new Map<number, string>();
  const rawHeaders: string[] = [];
  for (let c = 0; c <= maxCol; c++) {
    rawHeaders.push(headerCols.get(c) || '');
  }
  while (rawHeaders.length > 0 && rawHeaders[rawHeaders.length - 1] === '') {
    rawHeaders.pop();
  }
  if (rawHeaders.length === 0) {
    throw new Error('Не найдена строка заголовков на первом листе Excel');
  }

  const headers = normalizeHeaders(rawHeaders);
  const rows: Record<string, string>[] = [];
  for (const rIdx of rowIndices) {
    if (rIdx <= headerRowIdx) continue;
    const colMap = rowsMap.get(rIdx)!;
    const record: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((h, colIdx) => {
      const v = colMap.get(colIdx) ?? '';
      if (v !== '') hasValue = true;
      record[h] = v;
    });
    if (hasValue) {
      rows.push(record);
    }
  }

  return { format: 'xlsx', headers, rows };
}

export async function parseSpreadsheetBase64(
  fileName: string,
  contentBase64: string,
  explicitFormat?: SpreadsheetFormat
): Promise<ParsedSpreadsheet> {
  const cleanBase64 = contentBase64.includes(',')
    ? contentBase64.split(',').slice(1).join(',')
    : contentBase64;
  const buffer = Buffer.from(cleanBase64.trim(), 'base64');
  if (buffer.length === 0) {
    throw new Error('Загруженный файл пуст');
  }
  if (buffer.length > MAX_DECODED_BYTES) {
    throw new Error('Размер файла превышает допустимый лимит 5 МБ');
  }

  const isZipMagic = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  const lower = fileName.toLowerCase();
  const format: SpreadsheetFormat =
    explicitFormat || (isZipMagic || lower.endsWith('.xlsx') ? 'xlsx' : 'csv');

  if (format === 'xlsx') {
    if (!isZipMagic) {
      throw new Error('Файл не является корректным документом Excel (.xlsx)');
    }
    return parseXlsxBuffer(buffer);
  }

  return parseCsvBuffer(buffer);
}
