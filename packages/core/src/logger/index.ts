export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  userId?: string;
  agentId?: string;
  requestId?: string;
  sessionId?: string;
  operation?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | null, context?: LogContext): void;
  child(defaultContext: LogContext): Logger;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Console-based logger implementation
 */
class ConsoleLogger implements Logger {
  private minLevel: LogLevel;
  private defaultContext: LogContext;

  constructor(minLevel: LogLevel = 'info', defaultContext: LogContext = {}) {
    this.minLevel = minLevel;
    this.defaultContext = defaultContext;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString();
    const mergedContext = { ...this.defaultContext, ...context };
    const contextStr = Object.keys(mergedContext).length > 0
      ? ` ${JSON.stringify(mergedContext)}`
      : '';
    return `[${timestamp}] [${level.toUpperCase().padEnd(5)}] ${message}${contextStr}`;
  }

  private formatJSON(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error | null
  ): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.defaultContext,
      ...context,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };
    return JSON.stringify(logEntry);
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      if (process.env.LOG_FORMAT === 'json') {
        console.debug(this.formatJSON('debug', message, context));
      } else {
        console.debug(this.formatMessage('debug', message, context));
      }
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      if (process.env.LOG_FORMAT === 'json') {
        console.info(this.formatJSON('info', message, context));
      } else {
        console.info(this.formatMessage('info', message, context));
      }
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      if (process.env.LOG_FORMAT === 'json') {
        console.warn(this.formatJSON('warn', message, context));
      } else {
        console.warn(this.formatMessage('warn', message, context));
      }
    }
  }

  error(message: string, error?: Error | null, context?: LogContext): void {
    if (this.shouldLog('error')) {
      if (process.env.LOG_FORMAT === 'json') {
        console.error(this.formatJSON('error', message, context, error));
      } else {
        console.error(this.formatMessage('error', message, context));
        if (error?.stack) {
          console.error(error.stack);
        }
      }
    }
  }

  child(defaultContext: LogContext): Logger {
    return new ConsoleLogger(this.minLevel, {
      ...this.defaultContext,
      ...defaultContext,
    });
  }
}

// Singleton logger instance
let loggerInstance: Logger | null = null;

/**
 * Get the global logger instance
 */
export function getLogger(): Logger {
  if (!loggerInstance) {
    const level = (process.env.LOG_LEVEL as LogLevel) || 'info';
    loggerInstance = new ConsoleLogger(level);
  }
  return loggerInstance;
}

/**
 * Set a custom logger instance
 */
export function setLogger(customLogger: Logger): void {
  loggerInstance = customLogger;
}

/**
 * Create a child logger with default context
 */
export function createLogger(context: LogContext): Logger {
  return getLogger().child(context);
}

/**
 * Log timing for async operations
 */
export async function withTiming<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const logger = getLogger();
  const startTime = Date.now();

  logger.debug(`Starting ${operation}`, context);

  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    logger.info(`Completed ${operation}`, { ...context, duration });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      `Failed ${operation}`,
      error instanceof Error ? error : null,
      { ...context, duration }
    );
    throw error;
  }
}
