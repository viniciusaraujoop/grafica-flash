// Industry Pack Contract v1 — buildPackProposal. Pure. Never applies anything:
// apply/reapply/update/rollback remain MIGRATION_REQUIRED and BLOCKED_BY_M0.

import type { PackDiff, PackItemClassification, PackProposal, ProposalDecision } from './types'

function decide(
  item: PackItemClassification,
  includeRecommended: boolean,
): { decision: ProposalDecision; selectable: boolean } {
  switch (item.state) {
    case 'SAFE_ADDITION': {
      const optIn = item.kind === 'recipe' || item.kind === 'integration'
      if (item.requirement === 'required') return { decision: 'ADD', selectable: false }
      if (item.requirement === 'default' && !optIn) return { decision: 'ADD', selectable: true }
      if (item.requirement === 'recommended' && includeRecommended && !optIn) return { decision: 'ADD', selectable: true }
      return { decision: 'SKIP', selectable: true }
    }
    case 'SAME_VALUE':
      return { decision: 'KEEP_CURRENT', selectable: false }
    case 'CONFLICT':
      return item.blocking ? { decision: 'REQUIRES_MAPPING', selectable: true } : { decision: 'KEEP_CURRENT', selectable: true }
    case 'USER_OVERRIDE':
      return { decision: 'KEEP_CURRENT', selectable: true }
    case 'DEPRECATED_SETTING':
      return item.replacedBy ? { decision: 'SUGGEST_REPLACEMENT', selectable: true } : { decision: 'KEEP_CURRENT', selectable: true }
    case 'UNAVAILABLE':
    case 'ENTITLEMENT_BLOCKED':
    case 'INTEGRATION_UNAVAILABLE':
      return { decision: 'SKIP', selectable: false }
  }
}

export function buildPackProposal(diff: PackDiff, opts: { includeRecommended?: boolean } = {}): PackProposal {
  const includeRecommended = opts.includeRecommended === true
  const decisions: PackProposal['decisions'] = diff.items.map((item) => {
    const { decision, selectable } = decide(item, includeRecommended)
    return { kind: item.kind, id: item.id, state: item.state, defaultDecision: decision, userSelectable: selectable, reason: item.reason }
  })

  for (const removal of diff.removals) {
    const requiresMapping = removal.replacesFlow && removal.inUseCount > 0 && removal.state === 'CONFLICT'
    decisions.push({
      kind: removal.kind,
      id: removal.id,
      state: removal.state,
      defaultDecision: requiresMapping ? 'REQUIRES_MAPPING' : 'KEEP_CURRENT',
      userSelectable: true,
      reason: {
        code: requiresMapping ? 'REMOVAL_IN_USE_REQUIRES_MAPPING' : 'NOT_IN_PACK_KEPT',
        params: { scope: removal.scope, inUse: removal.inUseCount },
      },
    })
  }

  const blocking: PackProposal['blocking'] = decisions
    .filter((decision, index) =>
      index < diff.items.length ? diff.items[index].blocking : decision.defaultDecision === 'REQUIRES_MAPPING',
    )
    .map((decision) => ({ kind: decision.kind, id: decision.id, reason: decision.reason }))

  return {
    schemaVersion: 1,
    packRef: diff.packRef,
    diffFingerprint: diff.fingerprint,
    decisions,
    blocking,
    applicable: blocking.length === 0,
    notApplied: true,
    applyStatus: 'MIGRATION_REQUIRED_BLOCKED_BY_M0',
  }
}
