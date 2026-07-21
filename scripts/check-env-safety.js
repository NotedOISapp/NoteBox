const { execSync } = require('child_process');
const fs = require('fs');

const secretKeys = [
  'OPENAI_API_KEY',
  'DATABASE_URL',
  'APPLE_PRIVATE_KEY',
  'APP_STORE_CONNECT_API_KEY',
  'STORAGE_SECRET',
  'WEBHOOK_SECRET'
];

try {
  const trackedFiles = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);

  let failed = false;

  console.log("Checking tracked files for committed secrets...");

  for (const file of trackedFiles) {
    if (file.endsWith('.env.example') || file.startsWith('docs/') || file.endsWith('check-env-safety.js')) {
      continue;
    }

    if (fs.existsSync(file)) {
      const stat = fs.statSync(file);
      if (stat.isFile()) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split(/\r?\n/);
        lines.forEach((line, lineIndex) => {
          secretKeys.forEach(key => {
            const regex = new RegExp(`(^|\\s|\\b)${key}\\s*=\\s*(['"]?)([^'"\\s#]+)\\2`, 'i');
            const match = line.match(regex);
            if (match) {
              const val = match[3].trim();
              // Skip if line looks like code variable declaration or process.env set
              if (line.includes('const ') || line.includes('let ') || line.includes('var ') || line.includes('export ') || line.includes('process.env.' + key)) {
                return;
              }
              // Skip if value looks like a function call or property access
              if (val.includes('(') || val.includes(')') || val.includes('.') || val.includes('process.env')) {
                return;
              }
              // Ignore placeholders or empty strings
              if (val && !val.includes('YOUR_') && !val.includes('REPLACE_') && !val.startsWith('<') && !val.startsWith('$') && !val.includes('placeholder')) {
                console.error(`Potential secret exposed: "${key}" assignment found in file ${file} on line ${lineIndex + 1}`);
                failed = true;
              }
            }
          });
        });
      }
    }
  }

  if (failed) {
    console.error("Check failed! Potential secrets found in committed files.");
    process.exit(1);
  } else {
    console.log("All checks passed. No committed secrets found.");
    process.exit(0);
  }
} catch (error) {
  console.error("Failed to run git ls-files:", error);
  process.exit(1);
}
