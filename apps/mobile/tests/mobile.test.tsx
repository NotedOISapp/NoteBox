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
});
