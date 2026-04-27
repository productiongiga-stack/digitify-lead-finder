/**
 * Structured logger.
 *
 * Emits one JSON line per event so logs are searchable in any aggregator
 * (Datadog, Loki, CloudWatch, plain `jq`).
 *
 * Channels: "email" | "api" | "integration" | "job" | "auth" | "security"
 * Levels:   "debug" | "info" | "warn" | "error"
 *
 * Output is suppressed when NODE_ENV=test unless LOG_FORCE=1.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogChannel = "email" | "api" | "integration" | "job" | "auth" | "security";

export interface LogEntry {
  ts: string;
  level: LogLevel;
  channel: LogChannel;
  message: string;
  context?: Record<string, unknown>;
  error?: { name?: string; message: string; stack?: string };
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function configuredLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return raw === "debug" || raw === "info" || raw === "warn" || raw === "error" ? raw : "info";
}

function shouldEmit(level: LogLevel): boolean {
  if (process.env.NODE_ENV === "test" && process.env.LOG_FORCE !== "1") return false;
  return LEVEL_ORDER[level] >= LEVEL_ORDER[configuredLevel()];
}

function serializeError(err: unknown): LogEntry["error"] | undefined {
  if (!err) return undefined;
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return { message: String(err) };
}

let sink: ((entry: LogEntry) => void) | null = null;

function defaultSink(entry: LogEntry): void {
  if (!shouldEmit(entry.level)) return;
  const stream = entry.level === "error" || entry.level === "warn" ? console.error : console.log;
  try {
    stream(JSON.stringify(entry));
  } catch {
    stream(
      JSON.stringify({
        ts: entry.ts,
        level: entry.level,
        channel: entry.channel,
        message: entry.message,
        context: { _serialize: "failed" },
      }),
    );
  }
}

function emit(entry: LogEntry): void {
  if (sink) sink(entry);
  else defaultSink(entry);
}

function entry(
  level: LogLevel,
  channel: LogChannel,
  message: string,
  context?: Record<string, unknown>,
  err?: unknown,
): LogEntry {
  return {
    ts: new Date().toISOString(),
    level,
    channel,
    message,
    ...(context ? { context } : {}),
    ...(err ? { error: serializeError(err) } : {}),
  };
}

export interface ChannelLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>, err?: unknown): void;
  error(message: string, context?: Record<string, unknown>, err?: unknown): void;
}

function channel(name: LogChannel): ChannelLogger {
  return {
    debug: (m, c) => emit(entry("debug", name, m, c)),
    info: (m, c) => emit(entry("info", name, m, c)),
    warn: (m, c, e) => emit(entry("warn", name, m, c, e)),
    error: (m, c, e) => emit(entry("error", name, m, c, e)),
  };
}

export const log = {
  email: channel("email"),
  api: channel("api"),
  integration: channel("integration"),
  job: channel("job"),
  auth: channel("auth"),
  security: channel("security"),
};

/**
 * Test helper — installs an in-memory sink that captures every entry.
 * Returns a handle with the buffer and a release() function.
 */
export interface LogCapture {
  entries: LogEntry[];
  release(): void;
}

export function installLogCapture(): LogCapture {
  const entries: LogEntry[] = [];
  const previous = sink;
  sink = (e) => entries.push(e);
  return {
    entries,
    release() {
      sink = previous;
    },
  };
}
