import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  integrationTestIncludes,
  unitTestIncludes,
} from '../services/api/test-suites.mjs';
import { mobileTestIncludes } from '../apps/mobile/test-suites.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = path.join(repositoryRoot, 'services', 'api');
const mobileRoot = path.join(repositoryRoot, 'apps', 'mobile');

function walk(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'coverage'].includes(entry.name)) return [];
      return walk(absolutePath);
    }
    return entry.isFile() ? [absolutePath] : [];
  });
}

function globToRegExp(glob) {
  const normalized = glob.replaceAll('\\', '/');
  const tokenized = normalized
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replaceAll('**/', '__DIRECTORY_GLOB__')
    .replaceAll('**', '__DOUBLE_STAR__')
    .replaceAll('*', '[^/]*')
    .replaceAll('__DIRECTORY_GLOB__', '(?:.*/)?')
    .replaceAll('__DOUBLE_STAR__', '.*');
  return new RegExp(`^${tokenized}$`);
}

const suites = {
  unit: unitTestIncludes.map(globToRegExp),
  integration: integrationTestIncludes.map(globToRegExp),
};

const testFiles = [path.join(apiRoot, 'src'), path.join(apiRoot, 'tests')]
  .flatMap(walk)
  .filter((file) => file.endsWith('.test.ts'))
  .map((file) => path.relative(apiRoot, file).replaceAll('\\', '/'))
  .sort();

const classified = { unit: [], integration: [] };
const unclassified = [];
const overlaps = [];

for (const file of testFiles) {
  const matches = Object.entries(suites)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(file)))
    .map(([suite]) => suite);

  if (matches.length === 0) unclassified.push(file);
  if (matches.length > 1) overlaps.push(`${file} (${matches.join(', ')})`);
  for (const suite of matches) classified[suite].push(file);
}

if (testFiles.length === 0 || classified.unit.length === 0 || classified.integration.length === 0) {
  console.error('Each backend test run must contain at least one discovered test file.');
  process.exitCode = 1;
}
if (unclassified.length > 0) {
  console.error(`Unclassified backend test files:\n${unclassified.join('\n')}`);
  process.exitCode = 1;
}
if (overlaps.length > 0) {
  console.error(`Backend test files assigned to multiple suites:\n${overlaps.join('\n')}`);
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log(`Backend test classification passed: ${classified.unit.length} unit, ${classified.integration.length} integration, ${testFiles.length} total.`);
}

const mobilePatterns = mobileTestIncludes.map(globToRegExp);
const mobileTestFiles = walk(path.join(mobileRoot, 'tests'))
  .filter((file) => /\.test\.tsx?$/.test(file))
  .map((file) => path.relative(mobileRoot, file).replaceAll('\\', '/'))
  .sort();
const unclassifiedMobile = mobileTestFiles.filter((file) => !mobilePatterns.some((pattern) => pattern.test(file)));

if (mobileTestFiles.length === 0 || unclassifiedMobile.length > 0) {
  if (mobileTestFiles.length === 0) console.error('The mobile test run must contain at least one discovered test file.');
  if (unclassifiedMobile.length > 0) console.error(`Unclassified mobile test files:\n${unclassifiedMobile.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Mobile test classification passed: ${mobileTestFiles.length} files.`);
}
