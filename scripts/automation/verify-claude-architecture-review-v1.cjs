/* eslint-disable @typescript-eslint/no-require-imports -- Standalone workflow static contract tests. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const workflow = fs.readFileSync(
  path.join(__dirname, '../../.github/workflows/orcaly-claude-architecture-review-v1.yml'),
  'utf8'
);
const required = [
  'workflow_dispatch:',
  'github.actor == \'viniciusaraujoop\'',
  "github.ref == 'refs/heads/main'",
  'expected_head_sha:',
  'pr.head?.sha !== expected',
  "pr.head?.repo?.full_name !== context.repo.owner + '/' + context.repo.repo",
  "pr.base?.ref !== 'main'",
  'pr.base?.sha !== context.sha',
  'pr.user?.login !== \'viniciusaraujoop\'',
  'pr.changed_files > 15',
  "Buffer.byteLength(combined, 'utf8') > 65536",
  'persist-credentials: false',
  'github_token: ${{ github.token }}',
  'anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}',
  'show_full_output: false',
  'display_report: false',
  '--max-turns 8',
  '--max-budget-usd 1.00',
  '--allowedTools Read,Glob,Grep',
  '--disallowedTools Bash,Edit,Write,NotebookEdit,WebFetch,WebSearch,Task',
  '--json-schema',
  'git diff --exit-code',
  'git diff --cached --exit-code',
];
for (const t of required) assert.ok(workflow.includes(t), 'Required contract missing');
const forbidden = [
  'pull_request_target:', 'issue_comment:', 'repository_dispatch:', '\n  push:',
  '\n  schedule:', 'contents: write', 'pull-requests: write', 'issues: write',
  'id-token: write', 'permissions: write-all', 'gh pr create', 'git push',
  'secrets.SUPABASE_', 'secrets.VERCEL_', 'secrets.GH_PAT', 'show_full_output: true',
];
for (const t of forbidden) assert.ok(!workflow.includes(t), 'Forbidden contract present');

const scripts = [];
const lines = workflow.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i] !== '          script: |') continue;
  const code = [];
  for (let j = i + 1; j < lines.length; j++) {
    if (!lines[j].startsWith('            ') && lines[j].trim() !== '') break;
    code.push(lines[j].startsWith('            ') ? lines[j].slice(12) : '');
  }
  scripts.push(code.join('\n'));
}
assert.equal(scripts.length, 2, 'Expected two fixed trusted github-script blocks');
for (let i=0; i<scripts.length; i++) {
  new vm.Script(scripts[i], {filename: 'github-script-' + i});
}
const actionPin = workflow.match(/uses: anthropics\/claude-code-action@([0-9a-f]{40})/);
assert.ok(actionPin, 'Must pin Claude action by commit SHA');
assert.equal(actionPin[1], '6fed3ca145920b639991cb756090506e1bcaf515');
console.log('ORCALY_CLAUDE_REVIEW_STATIC_QA_PASS checks=' + (required.length + forbidden.length + scripts.length + 2));
