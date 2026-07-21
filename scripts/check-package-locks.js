const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const packageRoots = ['.', 'apps/mobile', 'services/api'];
const dependencySections = ['dependencies', 'devDependencies', 'optionalDependencies'];
let failed = false;

for (const relativeRoot of packageRoots) {
  const packageRoot = path.resolve(repositoryRoot, relativeRoot);
  const packagePath = path.join(packageRoot, 'package.json');
  const lockPath = path.join(packageRoot, 'package-lock.json');
  const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  const lockRoot = lock.packages?.[''];

  if (lock.lockfileVersion !== 3 || !lockRoot) {
    console.error(`${relativeRoot}: package-lock.json must be lockfileVersion 3 with a root package entry.`);
    failed = true;
    continue;
  }

  for (const [packageName, packageRecord] of Object.entries(lock.packages ?? {})) {
    const resolved = packageRecord?.resolved;
    if (typeof resolved !== 'string' || !/^https?:\/\//i.test(resolved)) continue;
    let hostname;
    try {
      hostname = new URL(resolved).hostname;
    } catch {
      console.error(`${relativeRoot}: ${packageName || '<root>'} has an invalid resolved URL.`);
      failed = true;
      continue;
    }
    if (hostname !== 'registry.npmjs.org') {
      console.error(`${relativeRoot}: ${packageName || '<root>'} resolves through non-public registry ${hostname}.`);
      failed = true;
    }
  }

  if (manifest.name !== lockRoot.name || (manifest.version ?? undefined) !== (lockRoot.version ?? undefined)) {
    console.error(`${relativeRoot}: package name/version differs from package-lock.json.`);
    failed = true;
  }

  if (JSON.stringify(manifest.engines ?? {}) !== JSON.stringify(lockRoot.engines ?? {})) {
    console.error(`${relativeRoot}: engines differs between package.json and package-lock.json.`);
    failed = true;
  }

  for (const section of dependencySections) {
    const declared = manifest[section] ?? {};
    const locked = lockRoot[section] ?? {};
    const names = new Set([...Object.keys(declared), ...Object.keys(locked)]);
    for (const name of names) {
      if (declared[name] !== locked[name]) {
        console.error(`${relativeRoot}: ${section}.${name} differs between package.json and package-lock.json.`);
        failed = true;
      }
    }
  }
}

if (failed) process.exit(1);
console.log('Package manifest/lock consistency and public-registry checks passed for root, mobile, and API packages.');
