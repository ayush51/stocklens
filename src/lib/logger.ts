/**
 * Minimal structured logger. Swap the transport later (e.g. pino + a log
 * drain) without changing call sites — every log call goes through here,
 * never console.log directly in feature code.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

const SECRET_KEY_PATTERN = /(key|token|secret|password|credential)/i;

function redact(fields?: LogFields): LogFields | undefined {
  if (!fields) return fields;
  const redacted: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    redacted[key] = SECRET_KEY_PATTERN.test(key) ? "[redacted]" : value;
  }
  return redacted;
}

function log(level: LogLevel, message: string, fields?: LogFields) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...redact(fields),
  };

  const method = level === "debug" ? "log" : level;
  console[method](JSON.stringify(entry));
}

export const logger = {
  debug: (message: string, fields?: LogFields) => log("debug", message, fields),
  info: (message: string, fields?: LogFields) => log("info", message, fields),
  warn: (message: string, fields?: LogFields) => log("warn", message, fields),
  error: (message: string, fields?: LogFields) => log("error", message, fields),
};
