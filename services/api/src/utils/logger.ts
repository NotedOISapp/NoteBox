/**
 * Structured logging utility with sensitive data redaction (SEC-080).
 */

const SENSITIVE_KEYS = new Set([
  'body',
  'notebody',
  'addmorebody',
  'addmoretext',
  'content',
  'receiptcontent',
  'objectkey',
  's3key',
  'receiptkey',
  'ocrtext',
  'extractedtext',
  'prompt',
  'aiprompt',
  'userprompt',
  'aioutput',
  'responsetext',
  'accesstoken',
  'refreshtoken',
  'jwt',
  'token',
  'identitytoken',
  'appleidentitytoken',
  'agegatetoken',
  'authorization',
  'code',
  'verificationcode',
  'otp',
  'hmac',
  'signedurl',
  'statustoken',
  'statustokenhash',
  'deletionstatustoken',
]);

const SEARCH_QUERY_KEYS = new Set(['query', 'searchquery', 'q']);

const TOKEN_REGEX = /(?:bearer\s+)?([A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)/gi;
const SIGNED_URL_REGEX = /https?:\/\/[^\s]+[\?&](?:X-Amz-Signature|signature|sig)=([A-Za-z0-9-_]+)/gi;

/**
 * Recursively redacts sensitive fields from objects and strings before logging.
 */
export function redactLogData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: data.stack,
    };
  }

  if (typeof data === 'string') {
    // Redact signed URLs
    if (data.match(/[\?&](?:X-Amz-Signature|signature|sig)=/i)) {
      return '[REDACTED_SIGNED_URL]';
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactLogData(item));
  }

  if (typeof data === 'object') {
    const redacted: Record<string, any> = {};
    const isApprovedSearch = data.approved === true && data.disclosed === true;

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (SENSITIVE_KEYS.has(lowerKey)) {
        redacted[key] = '[REDACTED]';
      } else if (SEARCH_QUERY_KEYS.has(lowerKey)) {
        if (isApprovedSearch) {
          redacted[key] = redactLogData(value);
        } else {
          redacted[key] = '[REDACTED]';
        }
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = redactLogData(value);
      } else if (typeof value === 'string') {
        if (value.match(/[\?&](?:X-Amz-Signature|signature|sig)=/i)) {
          redacted[key] = '[REDACTED_SIGNED_URL]';
        } else {
          redacted[key] = value;
        }
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  return data;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  requestId?: string;
  data?: any;
}

function formatLog(level: 'info' | 'warn' | 'error', message: string, data?: any, requestId?: string): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(requestId ? { requestId } : {}),
    ...(data !== undefined ? { data: redactLogData(data) } : {}),
  };
  return JSON.stringify(entry);
}

export function logInfo(message: string, data?: any, requestId?: string) {
  if (process.env.NODE_ENV !== 'test') {
    console.log(formatLog('info', message, data, requestId));
  }
}

export function logWarn(message: string, data?: any, requestId?: string) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(formatLog('warn', message, data, requestId));
  }
}

export function logError(message: string, data?: any, requestId?: string) {
  console.error(formatLog('error', message, data, requestId));
}

export const logger = {
  info: logInfo,
  warn: logWarn,
  error: logError,
};
