/* eslint-disable @typescript-eslint/no-require-imports -- Standalone evidence privacy gate. */
const fs = require('node:fs');
const path = require('node:path');
const c = require('../r10-contract.cjs');
const allowed = new Set(['runtime-versions.json', 'frontier-hash.json', 'replay-form-manifest.json',
  'migration-execution-log.json', 'resulting-migration-ledger.json', 'raw-schema-signature.json',
  'normalized-schema-signature.json', 'signature-diff.json', 'allowlist-application-report.json',
  'runtime-security-test-results.json', 'final-attestation.json', 'fresh-state.json']);
function inspectDirectory(temp) {
  const root = fs.realpathSync(temp), dir = path.join(root, 'r10-p4-evidence');
  if (fs.lstatSync(dir).isSymbolicLink() || !fs.statSync(dir).isDirectory()) throw Error('EVIDENCE_DIRECTORY_UNSAFE');
  const files = fs.readdirSync(dir);
  if (!files.includes('final-attestation.json')) throw Error('ATTESTATION_MISSING');
  for (const file of files) {
    const p = path.join(dir, file), stat = fs.lstatSync(p);
    if (!allowed.has(file) || !stat.isFile() || stat.isSymbolicLink()) throw Error('UNEXPECTED_ARTIFACT');
    const text = fs.readFileSync(p, 'utf8'); JSON.parse(text);
    if (c.inspectText(text).length || /(?:eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.|sb_secret_|postgres(?:ql)?:\/\/)/i.test(text)) throw Error('UNSAFE_ARTIFACT');
  }
  return files.length;
}
if (require.main === module) {
  try { console.log('P4_SAFE_ARTIFACT_COUNT:' + inspectDirectory(process.env.RUNNER_TEMP)); }
  catch { console.error('P4_ARTIFACT_UPLOAD_REFUSED'); process.exitCode = 1; }
}
module.exports = { inspectDirectory, allowed };
