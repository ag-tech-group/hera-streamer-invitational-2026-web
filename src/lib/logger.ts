import * as Sentry from "@sentry/react"

type LogLevel = "debug" | "info" | "warn" | "error"

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const configuredLevel: LogLevel =
  ((import.meta.env.VITE_LOG_LEVEL as string)?.toLowerCase() as LogLevel) ||
  (import.meta.env.DEV ? "debug" : "warn")

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[configuredLevel]
}

function formatLog(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
) {
  if (import.meta.env.DEV) {
    return { args: data ? [message, data] : [message] }
  }
  return {
    args: [
      JSON.stringify({
        level,
        message,
        ...data,
        timestamp: new Date().toISOString(),
      }),
    ],
  }
}

/**
 * Mirror a log into Sentry's Logs product so warn/error records are queryable
 * independent of a thrown error (e.g. the SSE stream reconnecting in a loop
 * without ever hitting an error boundary). Gated upstream by `shouldLog`, so
 * production — default level `warn` — forwards only warn/error and never the
 * per-event `info` analytics chatter. `Sentry.logger.*` no-ops safely when the
 * SDK is uninitialised (no DSN) or `enableLogs` is off, so this is inert in
 * local dev. The structured `data` rides along as queryable log attributes.
 */
function forwardToSentry(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): void {
  Sentry.logger[level](message, data)
}

export const logger = {
  debug(message: string, data?: Record<string, unknown>) {
    if (!shouldLog("debug")) return
    const { args } = formatLog("debug", message, data)
    console.debug(...args)
    forwardToSentry("debug", message, data)
  },

  info(message: string, data?: Record<string, unknown>) {
    if (!shouldLog("info")) return
    const { args } = formatLog("info", message, data)
    console.info(...args)
    forwardToSentry("info", message, data)
  },

  warn(message: string, data?: Record<string, unknown>) {
    if (!shouldLog("warn")) return
    const { args } = formatLog("warn", message, data)
    console.warn(...args)
    forwardToSentry("warn", message, data)
  },

  error(message: string, data?: Record<string, unknown>) {
    if (!shouldLog("error")) return
    const { args } = formatLog("error", message, data)
    console.error(...args)
    forwardToSentry("error", message, data)
  },
}
