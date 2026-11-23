import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { ATTESTATION_FAQ } from '../../data/researchData.ts';
import { CERTIFICATION_SCHEDULE, CONTACTS, formatSessionRange } from '../../data/landingContent.ts';
import { METHODOLOGICAL_MATERIALS } from '../../utils/accountKnowledgeBase.ts';

export const ASSISTANT_MODEL = 'gemini-4-hydrogen';

export const assistantMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().trim().min(1, 'Сообщение не может быть пустым.').max(2000, 'Сообщение слишком длинное (максимум 2000 символов).'),
});

export const assistantContextSchema = z
  .object({
    region: z.string().trim().max(120).optional(),
    roleLabel: z.string().trim().max(80).optional(),
    progressPercent: z.number().min(0).max(100).optional(),
    activeStageTitle: z.string().trim().max(160).optional(),
  })
  .optional();

export const assistantRequestSchema = z.object({
  messages: z
    .array(assistantMessageSchema)
    .min(1, 'Передайте хотя бы одно сообщение.')
    .max(20, 'История диалога ограничена 20 сообщениями.'),
  context: assistantContextSchema,
});

export type AssistantChatMessage = z.infer<typeof assistantMessageSchema>;
export type AssistantUserContext = z.infer<typeof assistantContextSchema>;

export class AssistantServiceError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 500, code = 'ASSISTANT_ERROR') {
    super(message);
    this.name = 'AssistantServiceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function buildRcaSystemInstruction(context?: AssistantUserContext): string {
  const faqDigest = ATTESTATION_FAQ.map(
    (item) => `- Вопрос: ${item.question}\n  Ответ: ${item.answer}`
  ).join('\n');

  const methodsDigest = METHODOLOGICAL_MATERIALS.map(
    (m) => `- ${m.code} (${m.normRef}): ${m.title}. ${m.keyPoints.join(' ')}`
  ).join('\n');

  const scheduleDigest = CERTIFICATION_SCHEDULE.map(
    (slot) => `- ${formatSessionRange(slot.start, slot.end)} (${slot.category})`
  ).join('\n');

  const candidateCtx = context
    ? [
        'Контекст текущего пользователя в Личном кабинете:',
        context.region ? `- Регион: ${context.region}` : null,
        context.roleLabel ? `- Роль: ${context.roleLabel}` : null,
        typeof context.progressPercent === 'number'
          ? `- Прогресс аттестации: ${context.progressPercent}%`
          : null,
        context.activeStageTitle ? `- Текущий этап: ${context.activeStageTitle}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return [
    'Ты — официальный ИИ-консультант службы поддержки Регионального центра аттестации (РЦА) «Русский Восток» на базе ВВГУ (г. Владивосток) и Федерации спортивного туризма России (ФСТР).',
    'Отвечай на русском языке — точно, структурированно, доброжелательно и строго по существу правил, регламентов и нормативной базы РЦА. Пиши чистым текстом (без символов разметки ** и #; для списков используй нумерацию 1., 2. или тире).',
    'Не выдумывай несуществующие приказы, цены или даты. Если вопрос выходит за рамки регламентов РЦА или требует индивидуальной проверки документов комиссией, предложи обратиться к куратору центра по контактам ниже.',
    '',
    'Официальные контакты и площадки:',
    `- Адрес центра и приёмной комиссии: ${CONTACTS.address} (ИТКИ ВВГУ)`,
    `- Телефон: ${CONTACTS.phone}, e-mail: ${CONTACTS.email}`,
    '- Руководитель РЦА: Григорий Саранча; председатель аттестационной комиссии: Галина Гомилевская (директор ИТКИ ВВГУ)',
    '- Полевой полигон практических испытаний: Шкотовский район Приморского края (в т.ч. хр. Ливадийский) и водные трассы края',
    '',
    'График аттестаций на 2027 год (1–4 КС, пешеходный, водный, горный, спелеологический и комбинации):',
    scheduleDigest,
    '',
    'Ключевые нормативные регламенты и FAQ РЦА:',
    faqDigest,
    '',
    'Методические регламенты:',
    methodsDigest,
    candidateCtx ? `\n${candidateCtx}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function extractUpstreamErrorInfo(err: unknown): {
  status?: number;
  apiStatus?: string;
  rawMessage: string;
} {
  const rawMessage = err instanceof Error ? err.message : String(err ?? 'Неизвестная ошибка');
  let status: number | undefined =
    typeof (err as { status?: unknown })?.status === 'number'
      ? (err as { status: number }).status
      : undefined;
  let apiStatus: string | undefined;

  try {
    const jsonStart = rawMessage.indexOf('{');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(rawMessage.slice(jsonStart)) as {
        error?: { code?: number; status?: string; message?: string };
      };
      if (typeof parsed.error?.code === 'number') status = parsed.error.code;
      if (typeof parsed.error?.status === 'string') apiStatus = parsed.error.status;
    }
  } catch {
    // non-JSON upstream message
  }

  return { status, apiStatus, rawMessage };
}

function isTransientUpstreamError(err: unknown): boolean {
  const { status, apiStatus, rawMessage } = extractUpstreamErrorInfo(err);
  if (status === 503 || status === 429 || status === 502 || status === 504) return true;
  if (apiStatus === 'UNAVAILABLE' || apiStatus === 'RESOURCE_EXHAUSTED') return true;
  return /high demand|temporarily unavailable|try again later|overloaded|ETIMEDOUT|ECONNRESET/i.test(
    rawMessage
  );
}

export function formatGeminiUpstreamError(err: unknown): AssistantServiceError {
  const { status, apiStatus, rawMessage } = extractUpstreamErrorInfo(err);

  if (status === 503 || apiStatus === 'UNAVAILABLE' || /high demand|overloaded/i.test(rawMessage)) {
    return new AssistantServiceError(
      'Модель ИИ сейчас испытывает повышенную нагрузку. Нажмите «Повторить» через несколько секунд.',
      503,
      'GEMINI_OVERLOADED'
    );
  }
  if (status === 429 || apiStatus === 'RESOURCE_EXHAUSTED') {
    return new AssistantServiceError(
      'Достигнут лимит запросов к сервису ИИ. Пожалуйста, повторите попытку чуть позже.',
      429,
      'GEMINI_RATE_LIMITED'
    );
  }
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    apiStatus === 'PERMISSION_DENIED' ||
    /API_KEY_INVALID|API key not valid/i.test(rawMessage)
  ) {
    return new AssistantServiceError(
      'Ключ GEMINI_API_KEY отклонён или недействителен. Проверьте его в панели Settings > Secrets.',
      502,
      'GEMINI_KEY_REJECTED'
    );
  }

  return new AssistantServiceError(
    'Сервис ИИ-консультанта временно недоступен. Попробуйте повторить запрос чуть позже.',
    502,
    'GEMINI_UPSTREAM_ERROR'
  );
}

const RETRY_DELAYS_MS = [500, 1200];

export async function generateRcaAssistantReply(rawInput: unknown): Promise<{
  reply: string;
  model: string;
}> {
  const parsed = assistantRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? 'Некорректные параметры запроса.';
    throw new AssistantServiceError(firstIssue, 400, 'VALIDATION_ERROR');
  }

  const { messages, context } = parsed.data;
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== 'user') {
    throw new AssistantServiceError(
      'Последнее сообщение в диалоге должно быть от пользователя.',
      400,
      'VALIDATION_ERROR'
    );
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new AssistantServiceError(
      'Сервис ИИ-консультанта не настроен: отсутствует серверный ключ GEMINI_API_KEY.',
      503,
      'GEMINI_NOT_CONFIGURED'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));
  const systemInstruction = buildRcaSystemInstruction(context);

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: ASSISTANT_MODEL,
        contents,
        config: { systemInstruction },
      });

      const text = response.text?.trim();
      if (!text) {
        throw new AssistantServiceError(
          'ИИ-ассистент вернул пустой ответ. Попробуйте переформулировать вопрос.',
          502,
          'EMPTY_AI_RESPONSE'
        );
      }

      return {
        reply: text,
        model: ASSISTANT_MODEL,
      };
    } catch (err) {
      if (err instanceof AssistantServiceError) {
        throw err;
      }
      lastError = err;
      if (attempt < RETRY_DELAYS_MS.length && isTransientUpstreamError(err)) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      break;
    }
  }

  throw formatGeminiUpstreamError(lastError);
}
