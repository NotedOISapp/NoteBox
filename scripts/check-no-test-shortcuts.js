const { execSync } = require('child_process');
const fs = require('fs');

const prohibitedPatterns = [
  '.only(',
  'describe.only',
  'it.only',
  'test.only',
  '.skip(',
  'describe.skip',
  'it.skip',
  'test.skip',
  '--passWithNoTests',
  'expect(true).toBe(true)',
  'expect(true).toEqual(true)'
];

const checkPattern = (content, pattern, file) => {
  if (file.endsWith('check-no-test-shortcuts.js')) {
    return false;
  }
  return content.includes(pattern);
};

try {
  const trackedFiles = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);

  let failed = false;

  console.log("Scanning tracked files for test shortcuts and weak assertions...");

  for (const file of trackedFiles) {
    if (fs.existsSync(file)) {
      const stat = fs.statSync(file);
      if (stat.isFile()) {
        const ext = file.split('.').pop().toLowerCase();
        if (['js', 'ts', 'jsx', 'tsx', 'vue', 'html'].includes(ext)) {
          if (file.startsWith('docs/archive/') || file.startsWith('node_modules/')) {
            continue;
          }
          const content = fs.readFileSync(file, 'utf8');
          for (const pattern of prohibitedPatterns) {
            if (checkPattern(content, pattern, file)) {
              console.error(`Prohibited pattern found: "${pattern}" in file ${file}`);
              failed = true;
            }
          }
        }
      }
    }
  }

  if (failed) {
    console.error("Check failed! Prohibited test shortcuts or assertions found.");
    process.exit(1);
  } else {
    console.log("All checks passed. No prohibited test shortcuts or weak assertions found.");
    process.exit(0);
  }
} catch (error) {
  console.error("Failed to run git ls-files:", error);
  process.exit(1);
}
