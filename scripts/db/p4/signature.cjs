/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CLI evidence processing. */
const zlib = require('node:zlib');
const c = require('../r10-contract.cjs');
// Preserve numeric lexemes (sequence bounds exceed JavaScript's safe integer range).
function lossless(text) {
  if (/"\$r10Number"\s*:/.test(text)) throw Error('RESERVED_NUMERIC_MARKER');
  let out = '', i = 0;
  while (i < text.length) {
    if (text[i] === '"') {
      const start = i++;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i++] === '"') break;
      }
      out += text.slice(start, i);
    } else {
      const number = text.slice(i).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (number) { out += '{"$r10Number":' + JSON.stringify(number[0]) + '}'; i += number[0].length; }
      else out += text[i++];
    }
  }
  return JSON.parse(out);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function frozen() {
  const packed = c.json('supabase/provenance/catalog/PRODUCTION_BASE_SIGNATURE.lossless.redacted.json');
  if (packed.encoding !== 'base64+gzip' || packed.raw_signature_sha256 !== c.SIGNATURE) throw Error('FROZEN_SIGNATURE_SOURCE_INVALID');
  const text = zlib.gunzipSync(Buffer.from(packed.data.join(''), 'base64'), { maxOutputLength: 25 * 1024 * 1024 }).toString('utf8');
  if (c.sha(text) !== packed.redacted_sha256 || c.inspectText(text).length) throw Error('FROZEN_LOSSLESS_HASH_OR_PRIVACY_FAILURE');
  return { text, payload: lossless(text), digest: packed.redacted_sha256 };
}
function expectedAfterAllowlist() {
  const expected = frozen();
  if (c.sha(c.read('supabase/provenance/replay/SIGNATURE_ALLOWLIST.json')) !== '40444929708b1ec12a1be15e30854c8b7dc37f1574069da920bd999c49572377') throw Error('REVIEWED_ALLOWLIST_BYTES_CHANGED');
  const list = c.json('supabase/provenance/replay/SIGNATURE_ALLOWLIST.json');
  const neutralPins = ['6b7711f711be247f2fd092696c01a2bf2b520203502135c3576669fef1eb0d1b',
    '12186458c08fcce1eb8446437dc25896e1f7d544d2c50ad3865e81f248826a0e',
    'f76f362329734c3b0aab10bad1c67b7bee3b27a7597dbca05b67771f316143fa',
    'dd52113ad4dccc535af01fd3ec0702e51fbdca75d99b5a61e4a138366e8e3635'];
  const classes = ['EXPECTED_ENVIRONMENT_DATA_DIFFERENCE', 'EXPECTED_INFRASTRUCTURE_DIFFERENCE', 'SECURITY_REQUIRED_DIFFERENCE', 'SECURITY_REQUIRED_DIFFERENCE'];
  if (list.default !== 'DENY_UNLISTED_DIFFERENCES' || JSON.stringify(list.entries.map(e => e.ordered_position)) !== '[1,3,18,30]') throw Error('ALLOWLIST_SCOPE_CHANGED');
  list.entries.forEach((e, i) => {
    if (c.sha(c.read(e.neutralization_evidence)) !== neutralPins[i]) throw Error('REVIEWED_NEUTRALIZATION_BYTES_CHANGED');
    if (e.classification !== classes[i] || e.blanket_function_body_allowance || e.grant_or_signature_difference_allowed) throw Error('ALLOWLIST_BROADENED');
    if (i < 3) {
      const n = c.json(e.neutralization_evidence);
      if (e.function_patch_hashes.length || JSON.stringify(e.exact_removed_units) !== JSON.stringify(n.removed_units.map(u => ({ raw_sha256: u.RAW_HASH, redacted_sha256: u.REDACTED_HASH })))) throw Error('OMITTED_DML_SCOPE_CHANGED');
    }
  });
  const entry = list.entries[3], neutral = c.json(entry.neutralization_evidence);
  if (neutral.exact_gate_patches.length !== 4 || JSON.stringify(entry.function_patch_hashes) !== JSON.stringify(neutral.exact_gate_patches.map(p => ({ function: p.function, before: p.before_sha256, after: p.after_sha256, remainder: p.unchanged_remainder_sha256 })))) throw Error('FUNCTION_PATCH_BINDING_CHANGED');
  const applied = [];
  for (const patch of neutral.exact_gate_patches) {
    if (c.sha(patch.before) !== patch.before_sha256 || c.sha(patch.after) !== patch.after_sha256) throw Error('GATE_HASH_CHANGED');
    const fns = expected.payload.functions.filter(f => f.schema + '.' + f.name === patch.function);
    if (fns.length !== 1 || fns[0].definition.split(patch.before).length !== 2) throw Error('FROZEN_GATE_NOT_EXACTLY_IDENTIFIED');
    fns[0].definition = fns[0].definition.replace(patch.before, () => patch.after);
    applied.push({ function: patch.function, before: patch.before_sha256, after: patch.after_sha256 });
  }
  // #1/#3/#18 omit DML/cron effects, not catalog definitions. Do NOT suppress any schema fields.
  return { expected, report: { default: list.default, applied_function_gates: applied, other_entries: 'DML/infrastructure omissions only; zero catalog exclusions', ignored_fields: [] } };
}
function differences(expected, actual, at = '', result = []) {
  if (JSON.stringify(canonical(expected)) === JSON.stringify(canonical(actual))) return result;
  if (expected && actual && typeof expected === 'object' && typeof actual === 'object' && !Array.isArray(expected) && !Array.isArray(actual)) {
    for (const key of [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()) differences(expected[key], actual[key], at + '/' + key, result);
  } else result.push({ path: at, expected_sha256: c.sha(JSON.stringify(canonical(expected)) || 'ABSENT'), actual_sha256: c.sha(JSON.stringify(canonical(actual)) || 'ABSENT') });
  return result;
}
function compare(actualText) {
  const { expected, report } = expectedAfterAllowlist();
  if (c.inspectText(actualText).length) throw Error('RUNTIME_SIGNATURE_SENSITIVE_CONTENT');
  const actual = lossless(actualText);
  const diff = differences(expected.payload, actual);
  return { matched: diff.length === 0, diff, allowlist: report, expected_normalized: canonical(expected.payload), actual_normalized: canonical(actual), frozen_raw_sha256: c.SIGNATURE, frozen_redacted_sha256: expected.digest };
}
module.exports = { lossless, canonical, frozen, expectedAfterAllowlist, compare, differences };
