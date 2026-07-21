import {
  RECEIPT_OCR_PROVIDER_TOKEN,
  RECEIPT_OCR_PROVIDER_URL,
  RECEIPT_PROCESSING_TIMEOUT_MS,
  RECEIPT_SCAN_PROVIDER_TOKEN,
  RECEIPT_SCAN_PROVIDER_URL,
} from '../config/env.js';

const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;

export interface ReceiptProviderInput {
  receiptId: string;
  bytes: Buffer;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  objectVersion: string | null;
}

export interface ReceiptScanResult {
  status: 'clean' | 'rejected';
  code: string;
  providerReference: string | null;
}

export interface ReceiptOcrResult {
  text: string;
  providerReference: string | null;
}

export interface ReceiptProcessingProvider {
  readonly name: string;
  scan(input: ReceiptProviderInput): Promise<ReceiptScanResult>;
  extractText(input: ReceiptProviderInput): Promise<ReceiptOcrResult>;
}

export class ReceiptProviderError extends Error {
  constructor(public readonly code: string, public readonly retryable: boolean) {
    super(code);
    this.name = 'ReceiptProviderError';
  }
}

function bindingVersion(input: ReceiptProviderInput): string {
  return input.objectVersion ?? 'unversioned';
}

function assertBoundResponse(payload: any, input: ReceiptProviderInput): void {
  if (
    !payload
    || payload.receiptId !== input.receiptId
    || payload.sha256 !== input.sha256
    || payload.objectVersion !== bindingVersion(input)
  ) {
    throw new ReceiptProviderError('PROVIDER_BINDING_MISMATCH', false);
  }
}

async function postPrivateObject(
  url: string,
  token: string,
  operation: 'scan' | 'ocr',
  input: ReceiptProviderInput,
): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECEIPT_PROCESSING_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': input.contentType,
        'x-notebox-operation': operation,
        'x-notebox-receipt-id': input.receiptId,
        'x-notebox-sha256': input.sha256,
        'x-notebox-object-version': bindingVersion(input),
        'x-notebox-size-bytes': String(input.sizeBytes),
      },
      body: input.bytes as any,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ReceiptProviderError(
        `PROVIDER_HTTP_${response.status}`,
        response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500,
      );
    }
    const contentLength = Number(response.headers.get('content-length') || '0');
    if (contentLength > MAX_PROVIDER_RESPONSE_BYTES) {
      throw new ReceiptProviderError('PROVIDER_RESPONSE_TOO_LARGE', false);
    }
    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_PROVIDER_RESPONSE_BYTES) {
      throw new ReceiptProviderError('PROVIDER_RESPONSE_TOO_LARGE', false);
    }
    try {
      return JSON.parse(body);
    } catch {
      throw new ReceiptProviderError('PROVIDER_RESPONSE_INVALID', false);
    }
  } catch (error) {
    if (error instanceof ReceiptProviderError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ReceiptProviderError('PROVIDER_TIMEOUT', true);
    }
    throw new ReceiptProviderError('PROVIDER_NETWORK_ERROR', true);
  } finally {
    clearTimeout(timeout);
  }
}

class HttpsReceiptProcessingProvider implements ReceiptProcessingProvider {
  readonly name = 'https-json-v1';

  async scan(input: ReceiptProviderInput): Promise<ReceiptScanResult> {
    const payload = await postPrivateObject(
      RECEIPT_SCAN_PROVIDER_URL,
      RECEIPT_SCAN_PROVIDER_TOKEN,
      'scan',
      input,
    );
    assertBoundResponse(payload, input);
    if (payload.status !== 'clean' && payload.status !== 'rejected') {
      throw new ReceiptProviderError('SCAN_RESPONSE_INVALID', false);
    }
    const code = typeof payload.code === 'string' && payload.code.length <= 128
      ? payload.code
      : payload.status === 'clean' ? 'SCAN_CLEAN' : 'SCAN_REJECTED';
    return {
      status: payload.status,
      code,
      providerReference: typeof payload.providerReference === 'string' && payload.providerReference.length <= 255
        ? payload.providerReference
        : null,
    };
  }

  async extractText(input: ReceiptProviderInput): Promise<ReceiptOcrResult> {
    const payload = await postPrivateObject(
      RECEIPT_OCR_PROVIDER_URL,
      RECEIPT_OCR_PROVIDER_TOKEN,
      'ocr',
      input,
    );
    assertBoundResponse(payload, input);
    if (typeof payload.text !== 'string' || payload.text.trim().length === 0) {
      throw new ReceiptProviderError('OCR_NO_TEXT', false);
    }
    if (Buffer.byteLength(payload.text, 'utf8') > MAX_PROVIDER_RESPONSE_BYTES) {
      throw new ReceiptProviderError('OCR_TEXT_TOO_LARGE', false);
    }
    return {
      text: payload.text,
      providerReference: typeof payload.providerReference === 'string' && payload.providerReference.length <= 255
        ? payload.providerReference
        : null,
    };
  }
}

let configuredProvider: ReceiptProcessingProvider | null | undefined;

export function setReceiptProcessingTestProvider(provider: ReceiptProcessingProvider | null): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Receipt processing test providers can only be configured in the test environment.');
  }
  configuredProvider = provider;
}

export function getReceiptProcessingProvider(): ReceiptProcessingProvider | null {
  if (configuredProvider !== undefined) return configuredProvider;
  if (!RECEIPT_SCAN_PROVIDER_URL || !RECEIPT_SCAN_PROVIDER_TOKEN || !RECEIPT_OCR_PROVIDER_URL || !RECEIPT_OCR_PROVIDER_TOKEN) {
    return null;
  }
  configuredProvider = new HttpsReceiptProcessingProvider();
  return configuredProvider;
}

export function isOcrSupportedContentType(contentType: string): boolean {
  const normalized = contentType.split(';', 1)[0].trim().toLowerCase();
  return normalized === 'application/pdf' || normalized.startsWith('image/');
}
