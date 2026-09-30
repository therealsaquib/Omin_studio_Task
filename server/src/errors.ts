import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorResponse(
  request: Request,
  status: number,
  code: string,
  message: string,
  fields: Record<string, string> = {},
) {
  return {
    error: {
      code,
      message,
      fields,
      requestId: request.requestId ?? "unavailable",
    },
  };
}

export function validationError(error: ZodError): AppError {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? (issue.code === "unrecognized_keys" ? issue.keys[0] : "_form"));
    fields[field] ??= issue.message;
  }
  return new AppError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", fields);
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction,
) => {
  if (response.headersSent) return;

  if (error instanceof ZodError) {
    const validation = validationError(error);
    response.status(validation.status).json(
      errorResponse(request, validation.status, validation.code, validation.message, validation.fields),
    );
    return;
  }

  if (error instanceof AppError) {
    response.status(error.status).json(
      errorResponse(request, error.status, error.code, error.message, error.fields),
    );
    return;
  }

  const parserError = error as { type?: string; status?: number; message?: string };
  if (parserError.type === "entity.parse.failed") {
    response.status(400).json(errorResponse(request, 400, "MALFORMED_JSON", "The request body contains malformed JSON."));
    return;
  }
  if (parserError.type === "entity.too.large" || parserError.status === 413) {
    response.status(413).json(errorResponse(request, 413, "PAYLOAD_TOO_LARGE", "The request body exceeds the 100kb limit."));
    return;
  }

  const message = error instanceof Error ? error.message : "Unknown server error";
  console.error(JSON.stringify({
    level: "error",
    requestId: request.requestId,
    message,
    stack: error instanceof Error ? error.stack : undefined,
  }));
  response.status(500).json(errorResponse(request, 500, "INTERNAL_ERROR", "Something went wrong. Please try again."));
};
