import { z } from 'zod';

export const OfficeDocKindSchema = z.enum(['xlsx', 'docx', 'pptx']);
export type OfficeDocKind = z.infer<typeof OfficeDocKindSchema>;

export const UniverSheetCellSchema = z.object({
  value: z.union([z.string(), z.number()]).default(''),
  formula: z.string().optional(),
  bold: z.boolean().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
});

export type UniverSheetCell = z.infer<typeof UniverSheetCellSchema>;

export const UniverSheetTabSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(64),
  rows: z.number().int().min(5).max(100).default(15),
  cols: z.number().int().min(3).max(26).default(8),
  cells: z.record(z.string(), UniverSheetCellSchema).default({}),
});

export const UniverWorkbookContentSchema = z.object({
  type: z.literal('xlsx'),
  sheets: z.array(UniverSheetTabSchema).min(1),
});

export const UniverDocBlockSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['heading', 'paragraph', 'bullet', 'callout']),
  text: z.string().max(4000),
});

export const UniverDocumentContentSchema = z.object({
  type: z.literal('docx'),
  subtitle: z.string().max(240).default(''),
  blocks: z.array(UniverDocBlockSchema).min(1),
});

export const UniverSlideItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(200),
  subtitle: z.string().max(300).default(''),
  bullets: z.array(z.string().max(400)).default([]),
  notes: z.string().max(1000).default(''),
  accentColor: z.string().default('#0077FF'),
});

export const UniverPresentationContentSchema = z.object({
  type: z.literal('pptx'),
  slides: z.array(UniverSlideItemSchema).min(1),
});

export const UniverContentSchema = z.discriminatedUnion('type', [
  UniverWorkbookContentSchema,
  UniverDocumentContentSchema,
  UniverPresentationContentSchema,
]);

export type UniverContent = z.infer<typeof UniverContentSchema>;

export const CreateOfficeDocumentSchema = z.object({
  title: z.string().trim().min(2, 'Укажите название документа').max(140),
  kind: OfficeDocKindSchema,
  dealId: z.string().optional().nullable(),
  bucketName: z.string().trim().min(3).max(64).optional(),
  forgejoRepoId: z.string().optional().nullable(),
  content: UniverContentSchema.optional(),
});

export const UpdateOfficeDocumentSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  dealId: z.string().optional().nullable(),
  content: UniverContentSchema,
  commitMessage: z.string().trim().max(200).optional(),
  forgejoRepoId: z.string().optional().nullable(),
});

export const UploadOfficeDocumentSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(5)
    .max(180)
    .refine(
      (name) => /\.(xlsx|docx|pptx)$/i.test(name),
      'Поддерживаются только офисные форматы .xlsx, .docx и .pptx'
    ),
  base64Content: z.string().min(8, 'Файл пуст'),
  dealId: z.string().optional().nullable(),
});

export const CreateGarageBucketSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Имя бакета минимум 3 символа')
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Допустимы только латиница в нижнем регистре, цифры и дефис'),
  visibility: z.enum(['private', 'tenant-read']).default('private'),
  quotaMb: z.coerce.number().int().min(100).max(102400).default(5120),
});

export const GARAGE_MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

export const UploadGarageObjectSchema = z.object({
  bucketName: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Выберите бакет S3')
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Некорректное имя бакета S3'),
  prefix: z
    .string()
    .trim()
    .max(180)
    .optional()
    .default('')
    .refine(
      (p) => !p.includes('..') && !p.includes('\\') && !/[\x00-\x1f]/.test(p),
      'Некорректный путь папки S3'
    ),
  fileName: z
    .string()
    .trim()
    .min(1, 'Укажите имя файла')
    .max(180)
    .refine(
      (name) =>
        !name.includes('/') &&
        !name.includes('\\') &&
        !name.includes('..') &&
        !/[\x00-\x1f]/.test(name) &&
        name !== '.' &&
        name !== '..',
      'Недопустимое имя файла'
    ),
  contentType: z.string().trim().max(140).optional(),
  base64Content: z
    .string()
    .min(1, 'Файл пуст')
    .max(22 * 1024 * 1024, 'Размер файла превышает лимит 15 МБ'),
});

export function normalizeS3Prefix(prefix?: string): string {
  if (!prefix) return '';
  return prefix
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '.' && s !== '..')
    .join('/');
}

export const CreateForgejoRepoSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, 'Имя репозитория минимум 2 символа')
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-_]*$/, 'Допустимы латиница, цифры, - и _'),
  description: z.string().trim().max(240).default(''),
  visibility: z.enum(['private', 'internal']).default('private'),
});

export const CommitOfficeToForgejoSchema = z.object({
  repoId: z.string().min(1, 'Выберите репозиторий Forgejo'),
  branch: z.string().trim().min(1).max(60).default('main'),
  message: z.string().trim().min(3, 'Укажите сообщение коммита').max(200),
});

export function colIndexToLetter(colIdx: number): string {
  let n = colIdx;
  let result = '';
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export function cellRefToCoords(ref: string): { row: number; col: number } | null {
  const m = /^([A-Z]+)(\d+)$/i.exec(ref.trim());
  if (!m) return null;
  const letters = m[1].toUpperCase();
  const row = parseInt(m[2], 10) - 1;
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  col -= 1;
  if (row < 0 || col < 0) return null;
  return { row, col };
}

export function coordsToKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/**
 * Evaluates Univer Sheets formulas safely without eval().
 * Supports =SUM(A1:A5), =AVERAGE(A1:A5), =MIN(...), =MAX(...), =COUNT(...),
 * and arithmetic expressions like =B2*C2 or =D2+D3-100.
 */
export function evaluateSheetCell(
  key: string,
  cells: Record<string, UniverSheetCell>,
  visited: Set<string> = new Set()
): string | number {
  const cell = cells[key];
  if (!cell) return '';
  const rawFormula = cell.formula?.trim();
  if (!rawFormula || !rawFormula.startsWith('=')) {
    return cell.value;
  }
  if (visited.has(key)) return '#CYCLE!';
  const nextVisited = new Set(visited);
  nextVisited.add(key);

  const expr = rawFormula.slice(1).trim();

  const resolveNumericRef = (ref: string): number => {
    const coords = cellRefToCoords(ref);
    if (!coords) return 0;
    const val = evaluateSheetCell(coordsToKey(coords.row, coords.col), cells, nextVisited);
    const num = typeof val === 'number' ? val : Number(String(val).replace(/\s+/g, '').replace(',', '.'));
    return Number.isFinite(num) ? num : 0;
  };

  const expandRange = (startRef: string, endRef: string): number[] => {
    const a = cellRefToCoords(startRef);
    const b = cellRefToCoords(endRef);
    if (!a || !b) return [];
    const rMin = Math.min(a.row, b.row);
    const rMax = Math.max(a.row, b.row);
    const cMin = Math.min(a.col, b.col);
    const cMax = Math.max(a.col, b.col);
    const nums: number[] = [];
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        const val = evaluateSheetCell(coordsToKey(r, c), cells, nextVisited);
        const num = typeof val === 'number' ? val : Number(String(val).replace(/\s+/g, '').replace(',', '.'));
        if (val !== '' && Number.isFinite(num)) {
          nums.push(num);
        }
      }
    }
    return nums;
  };

  const fnMatch = /^(SUM|AVERAGE|MIN|MAX|COUNT)\(([^)]+)\)$/i.exec(expr);
  if (fnMatch) {
    const fnName = fnMatch[1].toUpperCase();
    const arg = fnMatch[2].trim();
    const values: number[] = [];
    for (const part of arg.split(/[;,]/)) {
      const trimmed = part.trim();
      if (trimmed.includes(':')) {
        const [s, e] = trimmed.split(':');
        values.push(...expandRange(s, e));
      } else if (/^[A-Z]+\d+$/i.test(trimmed)) {
        values.push(resolveNumericRef(trimmed));
      } else {
        const n = Number(trimmed);
        if (Number.isFinite(n)) values.push(n);
      }
    }
    if (fnName === 'SUM') return values.reduce((a, b) => a + b, 0);
    if (fnName === 'AVERAGE') return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : 0;
    if (fnName === 'MIN') return values.length ? Math.min(...values) : 0;
    if (fnName === 'MAX') return values.length ? Math.max(...values) : 0;
    if (fnName === 'COUNT') return values.length;
  }

  // Simple arithmetic expression tokenizer (+, -, *, /)
  try {
    const substituted = expr.replace(/\b([A-Z]+\d+)\b/gi, (_, ref: string) =>
      String(resolveNumericRef(ref))
    );
    if (!/^[0-9+\-*/().\s]+$/.test(substituted)) {
      return '#ERR!';
    }
    const tokens = substituted.match(/\d+(?:\.\d+)?|[+\-*/()]/g);
    if (!tokens || tokens.length === 0) return '#ERR!';

    let pos = 0;
    const parseExpr = (): number => {
      let left = parseTerm();
      while (tokens[pos] === '+' || tokens[pos] === '-') {
        const op = tokens[pos++];
        const right = parseTerm();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    };
    const parseTerm = (): number => {
      let left = parseFactor();
      while (tokens[pos] === '*' || tokens[pos] === '/') {
        const op = tokens[pos++];
        const right = parseFactor();
        left = op === '*' ? left * right : right === 0 ? NaN : left / right;
      }
      return left;
    };
    const parseFactor = (): number => {
      if (tokens[pos] === '(') {
        pos++;
        const v = parseExpr();
        if (tokens[pos] === ')') pos++;
        return v;
      }
      if (tokens[pos] === '-') {
        pos++;
        return -parseFactor();
      }
      const n = Number(tokens[pos++]);
      return Number.isFinite(n) ? n : NaN;
    };

    const res = parseExpr();
    return Number.isFinite(res) ? Math.round(res * 100) / 100 : '#DIV/0!';
  } catch {
    return '#ERR!';
  }
}

export function buildDefaultContentForKind(kind: OfficeDocKind, title: string): UniverContent {
  if (kind === 'xlsx') {
    return {
      type: 'xlsx',
      sheets: [
        {
          id: 'sheet_1',
          name: 'Расчёт',
          rows: 12,
          cols: 6,
          cells: {
            '0:0': { value: 'Позиция', bold: true },
            '0:1': { value: 'Кол-во', bold: true },
            '0:2': { value: 'Цена (₽)', bold: true },
            '0:3': { value: 'Итого (₽)', bold: true },
            '1:0': { value: 'Лицензия портала', bold: false },
            '1:1': { value: 1 },
            '1:2': { value: 350000 },
            '1:3': { value: 350000, formula: '=B2*C2', bold: true },
            '2:0': { value: 'Интеграция DeepSeek-Harness' },
            '2:1': { value: 1 },
            '2:2': { value: 250000 },
            '2:3': { value: 250000, formula: '=B3*C3', bold: true },
            '3:0': { value: 'ИТОГО ПО СМЕТЕ', bold: true },
            '3:3': { value: 600000, formula: '=SUM(D2:D3)', bold: true },
          },
        },
      ],
    };
  }
  if (kind === 'docx') {
    return {
      type: 'docx',
      subtitle: 'Документ Univer Docs · сохранён в Garage S3',
      blocks: [
        { id: 'blk_1', kind: 'heading', text: title },
        {
          id: 'blk_2',
          kind: 'paragraph',
          text: 'Подготовлено для согласования архитектуры внедрения, матрицы прав RBAC и регламента SLA.',
        },
        {
          id: 'blk_3',
          kind: 'bullet',
          text: 'Выделенный контур на поддомене Traefik v3 и изоляция данных тенанта в PostgreSQL',
        },
        {
          id: 'blk_4',
          kind: 'callout',
          text: 'Все ревизии документа хранятся в объектном хранилище Garage S3 и фиксируются коммитами в Forgejo.',
        },
      ],
    };
  }
  return {
    type: 'pptx',
    slides: [
      {
        id: 'slide_1',
        title,
        subtitle: 'Архитектурный обзор · Univer Slides + Forgejo + Garage S3',
        bullets: [
          'Мультитенантная платформа NexusHarness CRM',
          'Автоматизация сделок на базе DeepSeek-Harness и Dify',
          'Единое S3-хранилище и Git-версионирование документов',
        ],
        notes: 'Вводный слайд для презентации клиенту.',
        accentColor: '#0077FF',
      },
      {
        id: 'slide_2',
        title: 'Безопасность, RBAC и хранение артефактов',
        subtitle: 'Изоляция контура каждого арендатора',
        bullets: [
          'Garage S3 бакеты с контролем целостности SHA-256 ETag',
          'Forgejo репозитории с Git LFS для версионирования КП и смет',
          'События реального времени через шину NATS JetStream',
        ],
        notes: 'Акцентировать внимание на контроле версий.',
        accentColor: '#0F172A',
      },
    ],
  };
}
