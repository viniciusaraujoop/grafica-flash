/* eslint-disable @typescript-eslint/no-require-imports -- Isolated GitHub Actions patch gate. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const exec = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
const allowed = name => name.startsWith('docs/automation/') &&
  /^[a-zA-Z0-9_./-]+\.md$/.test(name) &&
  !name.includes('..') &&
  !name.includes('//') &&
  name.length <= 180;

function stagedPaths() {
  const raw = exec('diff', '--cached', '--name-status', '--no-renames', '-z');
  const pieces = raw.split('\0').filter(Boolean);
  const files = [];
  for (let i = 0; i < pieces.length;) {
    const status = pieces[i++];
    if (!['A', 'M'].includes(status)) throw Error('UNAUTHORIZED_DIFF_STATUS');
    const name = pieces[i++];
    if (!name || !allowed(name)) throw Error('UNAUTHORIZED_DIFF_PATH');
    files.push(name);
  }
  if (files.length === 0 || files.length > 3 || new Set(files).size !== files.length) {
    throw Error('DIFF_FILE_COUNT_OUT_OF_POLICY');
  }
  return files;
}

function assertWorkspaceCleanOutsideScope() {
  const status = exec('status', '--porcelain=v1', '--untracked-files=all', '-z');
  const entries = status.split('\0').filter(Boolean);
  for (const entry of entries) {
    const flags = entry.slice(0, 2);
    const name = entry.slice(3);
    if (!allowed(name) || !/^[ AM?]{2}$/.test(flags)) throw Error('WORKTREE_OUT_OF_POLICY');
  }
}

function main() {
  assertWorkspaceCleanOutsideScope();
  const files = stagedPaths();
  for (const file of files) {
    const stats = fs.lstatSync(file);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size > 16384 || stats.size === 0) {
      throw Error('UNSAFE_FILE_OR_SIZE');
    }
    if (!path.resolve(file).startsWith(path.resolve('docs/automation') + path.sep)) {
      throw Error('PATH_ESCAPE');
    }
    const raw = fs.readFileSync(file);
    if (raw.includes(0) || raw.toString('utf8').includes('\uFFFD')) throw Error('NON_TEXT_FILE');
  }
  const patch = exec('diff', '--cached', '--no-ext-diff', '--binary', '--no-renames');
  if (Buffer.byteLength(patch, 'utf8') > 32768 || patch.includes('GIT binary patch') ||
      patch.includes('new file mode 120000') || patch.includes('old mode 120000')) {
    throw Error('PATCH_SIZE_OR_MODE_NOT_ALLOWED');
  }
  process.stdout.write('ORCALY_CODEX_PATCH_GATE_PASS files=' + files.length + '\n');
}
try { main(); } catch (e) {
  console.error('ORCALY_CODEX_PATCH_GATE_BLOCKED: ' + String(e.message).replace(/[^A-Z0-9_]/g, '_').slice(0, 80));
  process.exitCode = 1;
}
