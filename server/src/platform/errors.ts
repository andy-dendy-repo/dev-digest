/**
 * Domain error taxonomy + structured API error envelope. The UX taxonomy
 * (toast/inline/full-screen) is the frontend's concern; the API returns a
 * stable structured body (ApiErrorBody): { error: { code, message, details } }.
 */

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', details?: unknown) {
    super('not_found', message, 404, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super('validation_error', message, 422, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super('conflict', message, 409, details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string, details?: unknown) {
    super('external_service_error', message, 502, details);
  }
}

export class ConfigError extends AppError {
  constructor(message: string, details?: unknown) {
    super('config_error', message, 500, details);
  }
}

/**
 * A database write failed. Thrown by the unit of work in place of the driver
 * error, whose message (drizzle: `Failed query: <sql>\nparams: <all params>`)
 * can carry whole payloads. The message is short and safe to persist or show;
 * the original error stays on `cause` for the server log.
 */
export class PersistenceError extends AppError {
  constructor(message = 'Database write failed (details in the server log)', cause?: unknown) {
    super('persistence_error', message, 500);
    this.name = 'PersistenceError';
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}
