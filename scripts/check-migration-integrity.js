const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const drizzleRoot = path.join(repositoryRoot, 'services', 'api', 'drizzle');
const metaRoot = path.join(drizzleRoot, 'meta');
const journal = JSON.parse(fs.readFileSync(path.join(metaRoot, '_journal.json'), 'utf8'));
const policy = JSON.parse(fs.readFileSync(path.join(metaRoot, 'migration-policy.json'), 'utf8'));

const sqlTags = fs.readdirSync(drizzleRoot)
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .map((name) => name.slice(0, -4))
  .sort();
const journalTags = journal.entries.map((entry) => entry.tag);
const snapshotTags = new Set(fs.readdirSync(metaRoot)
  .filter((name) => /^\d{4}_snapshot\.json$/.test(name))
  .map((name) => {
    const index = Number(name.slice(0, 4));
    return journal.entries.find((entry) => entry.idx === index)?.tag;
  })
  .filter(Boolean));
const manualTags = new Set(policy.manualMigrationsWithoutSnapshots);
let failed = false;

if (JSON.stringify(sqlTags) !== JSON.stringify(journalTags)) {
  console.error('Drizzle SQL files and journal entries are not an exact ordered match.');
  failed = true;
}

journal.entries.forEach((entry, index) => {
  if (entry.idx !== index || entry.tag.slice(0, 4) !== String(index).padStart(4, '0')) {
    console.error(`Migration journal index is not contiguous at ${entry.tag}.`);
    failed = true;
  }
  if (index > 0 && entry.when <= journal.entries[index - 1].when) {
    console.error(`Migration journal timestamp is not increasing at ${entry.tag}.`);
    failed = true;
  }
  const hasSnapshot = snapshotTags.has(entry.tag);
  const isManual = manualTags.has(entry.tag);
  if (hasSnapshot === isManual) {
    console.error(`${entry.tag} must have exactly one classification: generated snapshot or approved manual migration.`);
    failed = true;
  }
});

for (const manualTag of manualTags) {
  if (!journalTags.includes(manualTag)) {
    console.error(`Migration policy references a missing journal entry: ${manualTag}.`);
    failed = true;
  }
}

if (!snapshotTags.has(policy.generatedSnapshotThrough)) {
  console.error('generatedSnapshotThrough must identify an existing snapshot-backed migration.');
  failed = true;
}

if (failed) process.exit(1);
console.log(`Migration integrity passed: ${journalTags.length} ordered migrations (${snapshotTags.size} generated, ${manualTags.size} manual).`);
