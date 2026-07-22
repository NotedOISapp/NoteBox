import { describe, it, expect } from 'vitest';
import { redactLogData } from './logger.js';

describe('Logging Redaction (SEC-080)', () => {
  it('redacts Note body', () => {
    const input = { noteId: '123', body: 'Private journal entry content' };
    const redacted = redactLogData(input);
    expect(redacted.body).toBe('[REDACTED]');
    expect(redacted.noteId).toBe('123');
  });

  it('redacts Add more body', () => {
    const input = { addMoreBody: 'Supplementary confidential thought', addMoreText: 'Secret note addition' };
    const redacted = redactLogData(input);
    expect(redacted.addMoreBody).toBe('[REDACTED]');
    expect(redacted.addMoreText).toBe('[REDACTED]');
  });

  it('redacts Receipt content and object keys where needed', () => {
    const input = { receiptId: 'rec_1', receiptContent: 'Raw receipt data', objectKey: 's3://private-bucket/rec_1.pdf', s3Key: 'rec_1.pdf' };
    const redacted = redactLogData(input);
    expect(redacted.receiptContent).toBe('[REDACTED]');
    expect(redacted.objectKey).toBe('[REDACTED]');
    expect(redacted.s3Key).toBe('[REDACTED]');
  });

  it('redacts OCR text', () => {
    const input = { ocrText: 'Extracted text from scanned receipt containing PII', extractedText: 'Tax ID: 12-3456789' };
    const redacted = redactLogData(input);
    expect(redacted.ocrText).toBe('[REDACTED]');
    expect(redacted.extractedText).toBe('[REDACTED]');
  });

  it('redacts AI prompt', () => {
    const input = { aiPrompt: 'Analyze this sensitive note: ...', userPrompt: 'Give perspective on my relationship' };
    const redacted = redactLogData(input);
    expect(redacted.aiPrompt).toBe('[REDACTED]');
    expect(redacted.userPrompt).toBe('[REDACTED]');
  });

  it('redacts AI output', () => {
    const input = { aiOutput: 'Here is your psychological perspective...', responseText: 'He may have felt uncertain...' };
    const redacted = redactLogData(input);
    expect(redacted.aiOutput).toBe('[REDACTED]');
    expect(redacted.responseText).toBe('[REDACTED]');
  });

  it('redacts JWT / access token', () => {
    const input = { accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJpYXQiOjE1MTYyMzkwMjJ9.X', jwt: 'secret.jwt.token' }; // gitleaks:allow -- synthetic redaction fixture
    const redacted = redactLogData(input);
    expect(redacted.accessToken).toBe('[REDACTED]');
    expect(redacted.jwt).toBe('[REDACTED]');
  });

  it('redacts refresh token', () => {
    const input = { refreshToken: 'refresh_token_secret_string_xyz' };
    const redacted = redactLogData(input);
    expect(redacted.refreshToken).toBe('[REDACTED]');
  });

  it('redacts verification codes', () => {
    const input = { verificationCode: '849302', otp: '123456', code: '998877' };
    const redacted = redactLogData(input);
    expect(redacted.verificationCode).toBe('[REDACTED]');
    expect(redacted.otp).toBe('[REDACTED]');
    expect(redacted.code).toBe('[REDACTED]');
  });

  it('redacts raw Apple identity token', () => {
    const input = { identityToken: 'apple.id.token.raw.jwt', appleIdentityToken: 'apple.raw.token' };
    const redacted = redactLogData(input);
    expect(redacted.identityToken).toBe('[REDACTED]');
    expect(redacted.appleIdentityToken).toBe('[REDACTED]');
  });

  it('redacts signed URLs', () => {
    const input = {
      signedUrl: 'https://s3.amazonaws.com/bucket/file.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc123secret',
      downloadLink: 'https://s3.amazonaws.com/export.zip?signature=secret_sig_value',
    };
    const redacted = redactLogData(input);
    expect(redacted.signedUrl).toBe('[REDACTED]');
    expect(redacted.downloadLink).toBe('[REDACTED_SIGNED_URL]');
  });

  it('redacts private search query text unless explicitly approved and disclosed', () => {
    const privateQuery = { query: 'my confidential search term', filter: 'recent' };
    const redactedPrivate = redactLogData(privateQuery);
    expect(redactedPrivate.query).toBe('[REDACTED]');
    expect(redactedPrivate.filter).toBe('recent');

    const approvedQuery = { query: 'disclosed public term', approved: true, disclosed: true };
    const redactedApproved = redactLogData(approvedQuery);
    expect(redactedApproved.query).toBe('disclosed public term');
  });

  it('redacts deletion status tokens', () => {
    const input = {
      statusToken: 'opaque_deletion_token',
      statusTokenHash: 'sha256_hash',
      deletionStatusToken: 'another_one',
    };
    const redacted = redactLogData(input);
    expect(redacted.statusToken).toBe('[REDACTED]');
    expect(redacted.statusTokenHash).toBe('[REDACTED]');
    expect(redacted.deletionStatusToken).toBe('[REDACTED]');
  });

  it('ensures no raw console.log/warn/error is used in production source files (except approved startup)', () => {
    const fs = require('fs');
    const path = require('path');

    function getFilesRecursively(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach((file: string) => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
          results = results.concat(getFilesRecursively(file));
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
          results.push(file);
        }
      });
      return results;
    }

    const srcDir = path.resolve(__dirname, '..');
    const files = getFilesRecursively(srcDir);
    const approvedFiles = [
      'index.ts',
      'db/migrate.ts',
      'compliance/storage.ts',
      'cron.ts',
      'setup.ts',
      'utils/logger.ts',
    ];

    const consoleUsageViolations: string[] = [];

    files.forEach((file) => {
      const relativePath = path.relative(srcDir, file).replace(/\\/g, '/');
      if (approvedFiles.includes(relativePath) || file.endsWith('.test.ts') || file.endsWith('.spec.ts')) {
        return;
      }
      const content = fs.readFileSync(file, 'utf8');
      if (content.match(/console\.(log|warn|error)/)) {
        consoleUsageViolations.push(relativePath);
      }
    });

    expect(consoleUsageViolations).toEqual([]);
  });
});
