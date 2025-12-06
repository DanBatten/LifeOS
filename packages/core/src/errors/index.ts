/**
 * Base error class for all LifeOS errors
 */
export class LifeOSError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'LifeOSError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * Database operation errors
 */
export class DatabaseError extends LifeOSError {
  public readonly operation?: string;
  public readonly table?: string;

  constructor(
    message: string,
    context?: Record<string, unknown> & { operation?: string; table?: string }
  ) {
    super(message, 'DATABASE_ERROR', context);
    this.name = 'DatabaseError';
    this.operation = context?.operation;
    this.table = context?.table;
  }
}

/**
 * LLM provider errors
 */
export class LLMError extends LifeOSError {
  public readonly provider: string;
  public readonly retryable: boolean;
  public readonly statusCode?: number;

  constructor(
    message: string,
    provider: string,
    options: {
      retryable?: boolean;
      statusCode?: number;
      context?: Record<string, unknown>;
    } = {}
  ) {
    super(message, 'LLM_ERROR', options.context);
    this.name = 'LLMError';
    this.provider = provider;
    this.retryable = options.retryable ?? false;
    this.statusCode = options.statusCode;
  }
}

/**
 * Agent execution errors
 */
export class AgentError extends LifeOSError {
  public readonly agentId: string;
  public readonly phase?: string;

  constructor(
    message: string,
    agentId: string,
    context?: Record<string, unknown> & { phase?: string }
  ) {
    super(message, 'AGENT_ERROR', context);
    this.name = 'AgentError';
    this.agentId = agentId;
    this.phase = context?.phase;
  }
}

/**
 * Validation errors
 */
export class ValidationError extends LifeOSError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(
    message: string,
    context?: Record<string, unknown> & { field?: string; value?: unknown }
  ) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
    this.field = context?.field;
    this.value = context?.value;
  }
}

/**
 * External integration errors (Google Calendar, Notion, etc.)
 */
export class IntegrationError extends LifeOSError {
  public readonly integration: string;
  public readonly operation?: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    integration: string,
    options: {
      operation?: string;
      retryable?: boolean;
      context?: Record<string, unknown>;
    } = {}
  ) {
    super(message, 'INTEGRATION_ERROR', options.context);
    this.name = 'IntegrationError';
    this.integration = integration;
    this.operation = options.operation;
    this.retryable = options.retryable ?? false;
  }
}

/**
 * Authentication/Authorization errors
 */
export class AuthError extends LifeOSError {
  public readonly userId?: string;

  constructor(message: string, context?: Record<string, unknown> & { userId?: string }) {
    super(message, 'AUTH_ERROR', context);
    this.name = 'AuthError';
    this.userId = context?.userId;
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends LifeOSError {
  public readonly retryAfter?: number;
  public readonly limit?: number;

  constructor(
    message: string,
    context?: Record<string, unknown> & { retryAfter?: number; limit?: number }
  ) {
    super(message, 'RATE_LIMIT_ERROR', context);
    this.name = 'RateLimitError';
    this.retryAfter = context?.retryAfter;
    this.limit = context?.limit;
  }
}

/**
 * Configuration errors
 */
export class ConfigError extends LifeOSError {
  public readonly configKey?: string;

  constructor(
    message: string,
    context?: Record<string, unknown> & { configKey?: string }
  ) {
    super(message, 'CONFIG_ERROR', context);
    this.name = 'ConfigError';
    this.configKey = context?.configKey;
  }
}

/**
 * Not found errors
 */
export class NotFoundError extends LifeOSError {
  public readonly resourceType: string;
  public readonly resourceId?: string;

  constructor(
    resourceType: string,
    resourceId?: string,
    context?: Record<string, unknown>
  ) {
    super(
      `${resourceType} not found${resourceId ? `: ${resourceId}` : ''}`,
      'NOT_FOUND_ERROR',
      { ...context, resourceType, resourceId }
    );
    this.name = 'NotFoundError';
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * Type guard to check if an error is a LifeOSError
 */
export function isLifeOSError(error: unknown): error is LifeOSError {
  return error instanceof LifeOSError;
}

/**
 * Wrap any error into a LifeOSError
 */
export function wrapError(
  error: unknown,
  defaultCode = 'UNKNOWN_ERROR'
): LifeOSError {
  if (error instanceof LifeOSError) {
    return error;
  }

  if (error instanceof Error) {
    return new LifeOSError(error.message, defaultCode, {
      originalError: error.name,
      stack: error.stack,
    });
  }

  return new LifeOSError(String(error), defaultCode);
}
