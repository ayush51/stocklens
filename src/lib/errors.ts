import { logger } from "@/lib/logger";

/**
 * AppError hierarchy — see docs/phase-0/07-api-design.md §3.
 *
 * Every Server Action / Route Handler throws (or returns) one of these
 * instead of letting a raw Prisma/Postgres error reach the client, which
 * could leak schema detail.
 */

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "BROKERAGE_SYNC_READONLY_VIOLATION"
  | "INTERNAL_ERROR";

const HTTP_STATUS_BY_CODE: Record<AppErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 502,
  BROKERAGE_SYNC_READONLY_VIOLATION: 403,
  INTERNAL_ERROR: 500,
};

/**
 * Codes worth logging as operational signal (provider down, unexpected
 * bug, security-boundary violation) — as opposed to VALIDATION_ERROR/
 * UNAUTHORIZED/NOT_FOUND, which are routine, expected outcomes of normal
 * user activity and would just be noise.
 */
const OPERATIONAL_CODES = new Set<AppErrorCode>([
  "UPSTREAM_UNAVAILABLE",
  "RATE_LIMITED",
  "BROKERAGE_SYNC_READONLY_VIOLATION",
  "INTERNAL_ERROR",
]);

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly httpStatus: number;
  /** Extra detail safe to show in the UI (e.g. field-level validation errors). */
  readonly detail?: unknown;

  constructor(code: AppErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = HTTP_STATUS_BY_CODE[code];
    this.detail = detail;

    // Logged at construction (not at the throw/catch site) so every
    // operational AppError gets structured logging automatically, no
    // matter where in the app it's thrown — this was previously a real gap:
    // a working logger existed (src/lib/logger.ts) but had zero call sites.
    if (OPERATIONAL_CODES.has(code)) {
      logger.error("app_error", { code, message, detail });
    }
  }

  toResponseBody(requestId: string) {
    return {
      error: {
        code: this.code,
        message: this.message,
        requestId,
      },
    };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
