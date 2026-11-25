import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { getOrCreateRequestId } from '../middleware/observability.ts';
import type { PortalRequest } from '../middleware/tenantAndAuth.ts';

export function sendApiError(
  req: Request,
  res: Response,
  status: number,
  error: string,
  code?: string,
  extra?: Record<string, unknown>
) {
  const requestId = getOrCreateRequestId(req);
  return res.status(status).json({
    error,
    ...(code ? { code } : {}),
    requestId,
    ...(extra || {}),
  });
}

export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  req: Request,
  res: Response,
  fallbackMessage = 'Некорректные данные запроса'
): z.infer<T> | null {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    sendApiError(req, res, 400, firstIssue?.message || fallbackMessage, 'VALIDATION_ERROR', {
      field: firstIssue?.path?.length ? firstIssue.path.join('.') : undefined,
    });
    return null;
  }
  return parsed.data;
}

export function asyncHandler(
  errorMessage: string,
  handler: (req: PortalRequest, res: Response, next: NextFunction) => Promise<unknown>
) {
  return async (req: PortalRequest, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      const requestId = getOrCreateRequestId(req);
      console.error(`[${requestId}] ${errorMessage}`, err);
      if (!res.headersSent) {
        sendApiError(req, res, 500, errorMessage, 'INTERNAL_ERROR');
      }
    }
  };
}

export function apiNotFoundHandler(req: Request, res: Response) {
  sendApiError(req, res, 404, `API маршрут не найден: ${req.method} ${req.originalUrl}`, 'NOT_FOUND');
}

export function apiErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (res.headersSent) {
    return next(err);
  }
  const maybeSyntax = err as { status?: number; type?: string; message?: string };
  if (maybeSyntax?.type === 'entity.parse.failed' || (err instanceof SyntaxError && maybeSyntax?.status === 400)) {
    return sendApiError(req, res, 400, 'Некорректный формат JSON в теле запроса', 'INVALID_JSON');
  }
  if (maybeSyntax?.type === 'entity.too.large' || maybeSyntax?.status === 413) {
    return sendApiError(req, res, 413, 'Размер тела запроса превышает допустимый лимит', 'PAYLOAD_TOO_LARGE');
  }
  const requestId = getOrCreateRequestId(req);
  console.error(`[${requestId}] Unhandled API error:`, err);
  return sendApiError(req, res, 500, 'Внутренняя ошибка сервера API', 'INTERNAL_ERROR');
}
