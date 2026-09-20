/** Leveled logger with a namespace prefix — silenced in production builds. */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

let currentLevel: LogLevel = import.meta.env?.DEV ? 'debug' : 'warn';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function enabled(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export function createLogger(namespace: string): Logger {
  const tag = `%c${namespace}`;
  const style = 'color:#8aa0b6;font-weight:600';
  return {
    debug: (...args: unknown[]) => enabled('debug') && console.debug(tag, style, ...args),
    info: (...args: unknown[]) => enabled('info') && console.info(tag, style, ...args),
    warn: (...args: unknown[]) => enabled('warn') && console.warn(tag, style, ...args),
    error: (...args: unknown[]) => enabled('error') && console.error(tag, style, ...args),
  };
}

export const logger = createLogger('glue-flip');
