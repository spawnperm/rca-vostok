import fs from 'fs';
import path from 'path';
import { z } from 'zod';

export interface AdrRecord {
  id: string;
  number: string;
  title: string;
  version: string;
  status: 'Accepted' | 'Proposed' | 'Deprecated' | 'Superseded';
  date: string;
  deciders: string;
  context: string;
  decision: string;
  consequences: string;
  alternatives: string;
  fileName: string;
}

export const CreateAdrSchema = z.object({
  number: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Номер ADR должен состоять из 4 цифр (например, 0005)'),
  title: z.string().trim().min(4, 'Название должно содержать минимум 4 символа').max(140),
  version: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+$/, 'Версия должна соответствовать SemVer (например, 1.0.0)')
    .default('1.0.0'),
  status: z.enum(['Accepted', 'Proposed', 'Deprecated', 'Superseded']).default('Accepted'),
  deciders: z.string().trim().min(2).max(120).default('Архитектурный комитет NexusHarness'),
  context: z.string().trim().min(10, 'Опишите архитектурный контекст (минимум 10 символов)'),
  decision: z.string().trim().min(10, 'Опишите принятое решение (минимум 10 символов)'),
  consequences: z.string().trim().min(5, 'Укажите последствия решения'),
  alternatives: z.string().trim().default('Сравнительный анализ зафиксирован в ADR.'),
});

const DEFAULT_ADRS: AdrRecord[] = [
  {
    id: 'adr_0001',
    number: '0001',
    title: 'Multi-Tenant изоляция данных на уровне PostgreSQL и X-Tenant-Subdomain',
    version: '1.2.0',
    status: 'Accepted',
    date: '2026-10-12',
    deciders: 'Платформенная команда · Архитектурный комитет',
    context:
      'Платформа обслуживает изолированные рабочие пространства корпоративных клиентов (acme, beta) в рамках единого кластера без утечек CRM и социальных данных.',
    decision:
      'Каждая таблица содержит обязательный tenant_id, middleware tenantAndAuth резолвит тенанта по JWT/поддомену, а Traefik маршрутизирует <subdomain>.platform.local.',
    consequences:
      'Исключена перекрёстная видимость сделок и сообщений между тенантами; упрощено горизонтальное шардирование.',
    alternatives: 'Отдельная БД на каждого тенанта — отклонена из-за накладных расходов на миграции.',
    fileName: 'ADR-0001-multi-tenant-isolation.md',
  },
  {
    id: 'adr_0002',
    number: '0002',
    title: 'Событийная шина NATS JetStream и Mattermost WebSocket синхронизация',
    version: '1.1.0',
    status: 'Accepted',
    date: '2026-10-20',
    deciders: 'Backend Lead · Integration Squad',
    context:
      'Менеджерам и роботам автоматизации нужны мгновенные уведомления при изменении этапов сделок, просрочке задач и комментариях в #news-feed.',
    decision:
      'Вся доменная мутация публикует события вида crm.<subdomain>.<entity>.<action> в внутреннюю шину с историей, DLQ replay и SSE/WS-доставкой на клиент.',
    consequences:
      'Обеспечена доставка push-напоминаний по дедлайнам задач в реальном времени и двусторонняя лента Mattermost.',
    alternatives: 'Polling каждые 5 секунд с прямой нагрузкой на БД — оставлен только как резервный fallback.',
    fileName: 'ADR-0002-nats-jetstream-events.md',
  },
  {
    id: 'adr_0003',
    number: '0003',
    title: 'RBAC с гранулярностью dataScope и маскированием ПДн (hiddenFields)',
    version: '1.0.0',
    status: 'Accepted',
    date: '2026-11-02',
    deciders: 'CISO · IAM Squad',
    context:
      'Разным ролям (Администратор, Руководитель, Менеджер, Наблюдатель) требуется разный объём видимости персональных контактов и бюджета сделок.',
    decision:
      'Внедрена матрица разрешений module:action, фильтр dataScope (all | own) и серверное скрытие полей (phone, email, companyName) по списку hiddenFields роли.',
    consequences:
      'Маскирование применяется на уровне Express-роутеров и Directus BI Connector до отправки JSON на клиент.',
    alternatives: 'Фильтрация только на фронтенде — отклонена как небезопасная.',
    fileName: 'ADR-0003-rbac-pii-masking.md',
  },
  {
    id: 'adr_0004',
    number: '0004',
    title: 'Версионирование документов Univer + Garage S3 + Forgejo Git Sync',
    version: '1.0.0',
    status: 'Accepted',
    date: '2026-11-10',
    deciders: 'Document Platform Team',
    context:
      'Коммерческие таблицы и регламенты должны редактироваться в браузере, сохраняться в S3-бакетах и фиксироваться в Git-репозитории.',
    decision:
      'Формат OOXML (.xlsx/.docx/.pptx) сериализуется в JSZip, хранится в Garage S3, а ревизии коммитятся с SHA в встроенный Forgejo-контур.',
    consequences:
      'Единая история версий и сквозной аудит изменений без зависимости от сторонних облачных офисных пакетов.',
    alternatives: 'Хранение бинарных blob в PostgreSQL BYTEA — отклонено для разгрузки основной БД.',
    fileName: 'ADR-0004-office-s3-forgejo.md',
  },
];

function getAdrStorePath(): string {
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'adrs.json');
}

function transliterateSlug(text: string): string {
  const ru: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'yo',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  };
  return text
    .toLowerCase()
    .split('')
    .map((ch) => (ru[ch] !== undefined ? ru[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function renderAdrMarkdown(adr: AdrRecord): string {
  return [
    `# ADR-${adr.number}: ${adr.title}`,
    '',
    `- **Версия:** v${adr.version}`,
    `- **Статус:** ${adr.status}`,
    `- **Дата:** ${adr.date}`,
    `- **Авторы решения:** ${adr.deciders}`,
    '',
    '## Контекст',
    adr.context,
    '',
    '## Принятое решение',
    adr.decision,
    '',
    '## Последствия',
    adr.consequences,
    '',
    '## Рассмотренные альтернативы',
    adr.alternatives,
    '',
  ].join('\n');
}

export function listAdrs(): AdrRecord[] {
  const storePath = getAdrStorePath();
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(DEFAULT_ADRS, null, 2), 'utf8');
    return DEFAULT_ADRS;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as AdrRecord[];
    }
  } catch {
    // Fallback to defaults if file is corrupted
  }
  return DEFAULT_ADRS;
}

export function createAdrRecord(input: z.infer<typeof CreateAdrSchema>): AdrRecord {
  const existing = listAdrs();
  if (existing.some((item) => item.number === input.number)) {
    throw new Error(`ADR-${input.number} уже существует в реестре`);
  }
  const slug = transliterateSlug(input.title) || 'decision';
  const record: AdrRecord = {
    id: `adr_${input.number}`,
    number: input.number,
    title: input.title,
    version: input.version,
    status: input.status,
    date: new Date().toISOString().slice(0, 10),
    deciders: input.deciders,
    context: input.context,
    decision: input.decision,
    consequences: input.consequences,
    alternatives: input.alternatives,
    fileName: `ADR-${input.number}-${slug}.md`,
  };
  const next = [record, ...existing].sort((a, b) => a.number.localeCompare(b.number));
  fs.writeFileSync(getAdrStorePath(), JSON.stringify(next, null, 2), 'utf8');
  return record;
}
