import { db } from '../db/index.js';
import { analyticsEvents } from '../db/schema.js';
import { logInfo, logWarn } from './logger.js';

export let telemetryViolationCount = 0;

export function getTelemetryViolationCount(): number {
  return telemetryViolationCount;
}

// Recursively checks for keys that might contain sensitive personal content
function hasForbiddenKeys(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;

  const forbidden = [
    'name', 'title', 'body', 'text', 'ocr', 'filename', 'content', 'payload',
    'response', 'output', 'description', 'subject', 'email', 'displayName',
    'fullName', 'contextLabel', 'extractedText'
  ];

  for (const key of Object.keys(obj)) {
    if (forbidden.some(f => key.toLowerCase().includes(f))) {
      return true;
    }
    // Also scan value if it's a string looking like an email or containing private data
    const val = obj[key];
    if (typeof val === 'string') {
      if (val.includes('@') && val.includes('.')) {
        return true; // potential email leak
      }
    }
    if (typeof val === 'object' && hasForbiddenKeys(val)) {
      return true;
    }
  }
  return false;
}

export async function trackEvent(
  userId: string | null,
  eventType: string,
  properties: Record<string, any> = {}
): Promise<void> {
  // If telemetry receives prohibited data, drop the event and increment violation counter
  if (hasForbiddenKeys(properties)) {
    telemetryViolationCount++;
    logWarn('Telemetry event dropped due to prohibited private data fields.', {
      eventType,
      userId: userId || 'anonymous'
    });
    return;
  }

  try {
    await db.insert(analyticsEvents).values({
      userId,
      eventType,
      properties,
    });

    logInfo('Telemetry event tracked successfully.', {
      userId: userId || 'anonymous',
      eventType
    });
  } catch (error) {
    // Fail silently relative to business operations
    logWarn('Failed to log telemetry event', { errorCode: 'TELEMETRY_WRITE_FAILED' });
  }
}
