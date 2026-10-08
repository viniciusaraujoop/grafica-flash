'use strict';

/**
 * Pure, read-only GitHub status projection for Orçaly.
 * Never calls agents or marks work completed without Github evidence.
 * GitHub Actions passes only sanitized public issue/PR/run metadata.
 */

const EXECUTOR_WORKFLOWS = Object.freeze([
  'Orçaly Codex Agent Pilot - Founder Dispatch',
  'Orçaly Claude Architecture Review V1',
]);

const clean = (v, max = 140) => String(v ?? '')
  .replace(/[^\p{L}\p{N} _./:#,()-]/gu, ' ')
  .trim()
  .slice(0, max);

const isActive = status => status === 'in_progress' || status === 'queued' || status === 'pending';
const identity = v => Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;

function buildReport({issues = [], prs = [], runs = [], generatedAt = '', repo = ''}) {
  if (!Array.isArray(issues) || !Array.isArray(prs) || !Array.isArray(runs)) {
    throw new Error('INVALID_COLLECTIONS');
  }
  const recent = runs.slice(0, 100);
  const actualExecution = recent.filter(r => EXECUTOR_WORKFLOWS.includes(r.name) && isActive(r.status));
  const running = actualExecution.filter(r => r.status === 'in_progress');
  const waiting = actualExecution.filter(r => r.status !== 'in_progress');
  const missions = issues.filter(i => !i.pull_request && /^\[AGENT(?:\s|\])/i.test(String(i.title || '')))
    .map(i => ({
      number: identity(i.number),
      title: clean(i.title, 110),
      state: 'REGISTERED_NO_EXECUTION_EVIDENCE',
      updated_at: clean(i.updated_at, 32),
    })).filter(i => i.number).slice(0, 50);

  const pullRequests = prs.map(pr => {
    const relevant = recent
      .filter(r => r.event === 'pull_request' && r.head_branch === pr.head?.ref &&
        r.head_sha === pr.head?.sha && r.name === 'Orçaly Platform Quality Gate')
      .sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const gate = relevant.length ? String(relevant[0].conclusion || relevant[0].status || 'unknown') : 'UNVERIFIED';
    return {
      number: identity(pr.number),
      title: clean(pr.title, 100),
      head_sha: clean(pr.head?.sha, 40),
      draft: Boolean(pr.draft),
      quality_gate: gate,
      state: gate === 'failure' ? 'CI_BLOCKED' : (pr.draft ? 'DRAFT_REVIEW_PENDING' : 'HUMAN_REVIEW_PENDING'),
      updated_at: clean(pr.updated_at, 32),
    };
  }).filter(pr => pr.number).slice(0, 50);

  const observed = actualExecution.map(r => ({
    run_id: identity(r.id),
    workflow: clean(r.name, 100),
    state: clean(r.status, 24),
    created_at: clean(r.created_at, 32),
  })).filter(r => r.run_id);

  return {
    schema_version: 1,
    generated_at: clean(generatedAt, 40),
    repository: clean(repo, 120),
    monitoring: 'ACTIVE_WHEN_WORKFLOW_RUNS',
    mode: 'READ_ONLY_NO_PAID_AI',
    paid_ai_enabled: false,
    autonomous_code_dispatch_enabled: false,
    evidence_scope: 'CURRENT_OPEN_ITEMS_AND_LATEST_100_WORKFLOW_RUNS_ONLY',
    active_ai_runs_observed: running.length,
    queued_ai_runs_observed: waiting.length,
    active_execution_evidence: observed,
    missions,
    pull_requests: pullRequests,
    blocked_pr_numbers: pullRequests.filter(p => p.quality_gate === 'failure').map(p => p.number),
    caution: 'No active run observed does not prove a separate ChatGPT/Claude session is idle.',
  };
}

function renderSummary(r) {
  const row = s => clean(s, 120);
  const lines = [
    '# Orçaly Autopilot Watchtower V1',
    '',
    '**OBSERVABILITY_ONLY** | No paid AI calls, no dispatch, no merge, no DB access.',
    '',
    'Generated: ' + row(r.generated_at),
    '',
    '- **Verified AI executor runs active:** ' + r.active_ai_runs_observed,
    '- **Verified AI executor runs queued:** ' + r.queued_ai_runs_observed,
    '- **Agent missions registered (NOT evidence of execution):** ' + r.missions.length,
    '- **Open PRs observed:** ' + r.pull_requests.length,
    '- **PRs with evidenced failed Quality Gate:** ' + r.blocked_pr_numbers.join(', '),
    '',
    '## Missions',
    ...r.missions.map(i => '- #' + i.number + ' ' + row(i.title) + ': registered, not verified working'),
    '',
    '## Pull requests',
    ...r.pull_requests.map(i => '- #' + i.number + ' ' + row(i.title) + ' | ' + i.state + ' | Quality Gate: ' + i.quality_gate),
    '',
    '## Evidence limits',
    '- This report cannot tell whether agents in separate chat sessions are thinking or working.',
    '- A created Issue is not execution. A passed static test is not a production release.',
    '- GitHub Actions scheduled triggers may be delayed and only run after this branch reaches the default branch.',
    '- Paid GPT-6 / Claude / Codex work is not launched by this workflow.',
  ];
  return lines.join('\n').slice(0, 26000) + '\n';
}

module.exports = {EXECUTOR_WORKFLOWS, buildReport, renderSummary};
