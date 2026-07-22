import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(mobileRoot, 'src');
const requiredRoutes = [
  'app/_layout.tsx',
  'app/index.tsx',
  'app/age-gate.tsx',
  'app/onboarding.tsx',
  'app/note/compose.tsx',
  'app/box/[id].tsx',
  'app/note/[id].tsx',
  'app/patterns.tsx',
  'app/profile.tsx',
];

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    return entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });
}

describe('mobile repository contracts', () => {
  it('provides real Expo Router modules for every required v1 route', () => {
    for (const route of requiredRoutes) {
      const routePath = path.join(sourceRoot, route);
      expect(fs.existsSync(routePath), `Missing route module: ${route}`).toBe(true);
      expect(fs.readFileSync(routePath, 'utf8'), `Missing default export: ${route}`).toMatch(/export\s+default\s+/);
    }
  });

  it('keeps prohibited CRM and therapy-session copy out of shipped source', () => {
    const prohibited = /\b(?:crm|lead management|sales pipeline|conversion rate|therapy session)\b/i;
    const violations = sourceFiles(sourceRoot)
      .filter((file) => prohibited.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(mobileRoot, file).replaceAll('\\', '/'));

    expect(violations).toEqual([]);
  });

  it('mounts StoreKit recovery at the authenticated app lifecycle boundary', () => {
    const layout = fs.readFileSync(path.join(sourceRoot, 'app/_layout.tsx'), 'utf8');
    expect(layout).toContain('<StoreKitRecovery />');
  });

  it('hides covered content from touch and accessibility navigation', () => {
    const layout = fs.readFileSync(path.join(sourceRoot, 'app/_layout.tsx'), 'utf8');
    expect(layout).toContain("pointerEvents={shouldCoverPrivateContent ? 'none' : 'auto'}");
    expect(layout).toContain('accessibilityElementsHidden={shouldCoverPrivateContent}');
    expect(layout).toContain("importantForAccessibility={shouldCoverPrivateContent ? 'no-hide-descendants' : 'auto'}");
  });

  it('uses localized StoreKit terms without inventing a trial date or old product vocabulary', () => {
    const paywall = fs.readFileSync(path.join(sourceRoot, 'components/paywall.tsx'), 'utf8');
    expect(paywall).toContain('loadNoteBoxSubscriptionProduct');
    expect(paywall).toContain('product?.displayPrice');
    expect(paywall).not.toContain('trialDate');
    expect(paywall).not.toMatch(/14-day|vault/i);
  });

  it('tries idempotent Receipt confirmation before requiring the encrypted local file', () => {
    const appContext = fs.readFileSync(path.join(sourceRoot, 'context/AppContext.tsx'), 'utf8');
    const receiptCase = appContext.slice(appContext.indexOf("case 'receipt.upload'"), appContext.indexOf("case 'addMore.create'"));
    expect(receiptCase.indexOf('api.receipts.confirm')).toBeGreaterThan(-1);
    expect(receiptCase.indexOf('api.receipts.confirm')).toBeLessThan(receiptCase.indexOf('materializeReceiptUploadAsset'));
    expect(receiptCase.indexOf('afterCommit')).toBeLessThan(receiptCase.indexOf('removePersistedReceiptUploadAsset'));
  });

  it('starts export polling when a newly requested ticket enters state', () => {
    const profile = fs.readFileSync(path.join(sourceRoot, 'app/profile.tsx'), 'utf8');
    expect(profile).toContain('setExportTicketId(exportRequest.ticketId)');
    expect(profile).toContain('}, [exportTicketId]);');
  });

  it('reports a secured offline Receipt before attempting a best-effort refresh', () => {
    const noteDetail = fs.readFileSync(path.join(sourceRoot, 'app/note/[id].tsx'), 'utf8');
    const successCopy = noteDetail.indexOf("Alert.alert('Receipt saved for upload'");
    const refresh = noteDetail.indexOf('void syncWithBackend()', successCopy);
    expect(successCopy).toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(successCopy);
    expect(noteDetail).not.toContain('await Promise.all([loadReceipts(), syncWithBackend()])');
  });

  it('refreshes canonical state before reporting a permanent queue rejection', () => {
    const appContext = fs.readFileSync(path.join(sourceRoot, 'context/AppContext.tsx'), 'utf8');
    const syncBlock = appContext.slice(
      appContext.indexOf('const syncWithBackend = useCallback'),
      appContext.indexOf('// Load cache on mount'),
    );
    const rememberedFailure = syncBlock.indexOf('mutationFailure = error');
    const canonicalFetch = syncBlock.indexOf('api.areas.list()');
    const surfacedFailure = syncBlock.indexOf('if (mutationFailure) throw mutationFailure');

    expect(rememberedFailure).toBeGreaterThan(-1);
    expect(canonicalFetch).toBeGreaterThan(rememberedFailure);
    expect(surfacedFailure).toBeGreaterThan(canonicalFetch);
  });
});
