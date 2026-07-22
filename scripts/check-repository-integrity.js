const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const ignoredDirectories = new Set(['node_modules', 'dist', 'build', 'coverage', '.expo']);
const generatedTestArtifact = /\.(?:js|js\.map|d\.ts|d\.ts\.map)$/;
let failed = false;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git') {
        if (path.resolve(absolutePath) !== path.join(repositoryRoot, '.git')) {
          console.error(`Nested .git directory found: ${path.relative(repositoryRoot, absolutePath)}`);
          failed = true;
        }
      } else if (ignoredDirectories.has(entry.name)) {
        continue;
      } else {
        walk(absolutePath);
      }
    }
  }
}

walk(repositoryRoot);

const index = execFileSync('git', ['ls-files', '-s'], { cwd: repositoryRoot, encoding: 'utf8' });
if (index.split(/\r?\n/).some((line) => line.startsWith('160000 '))) {
  console.error('Gitlink/submodule entry (mode 160000) found.');
  failed = true;
}

const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: repositoryRoot, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((file) => file.replaceAll('\\', '/'));
const forbiddenTracked = tracked.filter((file) =>
  /(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example')
  || /\.(?:zip|p8|pem|key|mobileprovision|provisionprofile|ipa|apk|aab)$/i.test(file)
  || /^services\/api\/tests\//.test(file) && generatedTestArtifact.test(file),
);

if (forbiddenTracked.length > 0) {
  console.error(`Forbidden tracked secrets, archives, signing artifacts, or generated test outputs:\n${forbiddenTracked.join('\n')}`);
  failed = true;
}

if (failed) process.exit(1);
console.log('Repository integrity passed: no gitlinks, nested repositories, forbidden tracked artifacts, or generated test outputs.');
