// Setup proposal construction (§27 of the T2 mission). Produces PROPOSAL DATA ONLY by composing the
// certified T1 functions (resolvePack → diffPackAgainstCompany → buildPackProposal).
// Never applies, never persists, never reads a database: the company snapshot is supplied by the caller.

import type { HashFn } from '../../wave1/shared/canonical'
import type { ValidationIssue } from '../../wave1/shared/result'
import { diffPackAgainstCompany } from '../../industry-packs/core/diff'
import { buildPackProposal } from '../../industry-packs/core/proposal'
import { resolvePack } from '../../industry-packs/core/resolve'
import type { CompanyConfigurationSnapshot, IndustryPackDefinition, PackProposal, PackRegistrySnapshot } from '../../industry-packs/core/types'
import { SMART_SETUP_PACKS, type Outcome, type RecommendedCapability, type SmartSetupPackKey, type SmartSetupRecommendation } from './types'

export type SetupProposalStatus =
  | 'PROPOSAL_READY'
  | 'REFERENCE_ONLY_NO_COMPANY_SNAPSHOT'
  | 'USER_CHOICE_REQUIRED'
  | 'PACK_UNAVAILABLE'
  | 'INVALID_USER_SELECTION'

export type SetupProposal = {
  schemaVersion: 1
  status: SetupProposalStatus
  outcome: Outcome
  /** Where the pack came from: the engine's primary, or an explicit manual user choice. */
  source: 'RECOMMENDED_PRIMARY' | 'USER_CHOICE' | null
  packRef: string | null
  candidates: readonly SmartSetupPackKey[]
  recommendedCapabilities: readonly RecommendedCapability[]
  packProposal: PackProposal | null
  issues: ValidationIssue[]
  /** Every proposal needs explicit user confirmation; nothing is ever applied by T2. */
  requiresUserConfirmation: true
  notApplied: true
  applyStatus: 'NOT_AUTHORIZED'
}

export type ProposalOptions = {
  catalog: readonly IndustryPackDefinition[]
  hash: HashFn
  company?: CompanyConfigurationSnapshot
  registry?: PackRegistrySnapshot
  includeRecommended?: boolean
  /** Manual choice is always possible (§0): the user may pick any Wave 1 pack explicitly. */
  userSelection?: string
}

function base(recommendation: SmartSetupRecommendation, status: SetupProposalStatus, extra: Partial<SetupProposal> = {}): SetupProposal {
  return {
    schemaVersion: 1,
    status,
    outcome: recommendation.outcome,
    source: null,
    packRef: null,
    candidates: recommendation.candidates,
    recommendedCapabilities: recommendation.recommendedCapabilities,
    packProposal: null,
    issues: [],
    requiresUserConfirmation: true,
    notApplied: true,
    applyStatus: 'NOT_AUTHORIZED',
    ...extra,
  }
}

export function buildSetupProposal(recommendation: SmartSetupRecommendation, options: ProposalOptions): SetupProposal {
  let pack: SmartSetupPackKey | null = recommendation.primaryPack
  let source: SetupProposal['source'] = pack ? 'RECOMMENDED_PRIMARY' : null

  if (options.userSelection !== undefined) {
    if (!(SMART_SETUP_PACKS as readonly string[]).includes(options.userSelection)) {
      return base(recommendation, 'INVALID_USER_SELECTION', { issues: [{ code: 'SMART_SETUP_SELECTION_INVALID', path: 'userSelection', severity: 'error' }] })
    }
    pack = options.userSelection as SmartSetupPackKey
    source = 'USER_CHOICE'
  }

  // AMBIGUOUS / NO_CLEAR_MATCH without an explicit choice: never pick for the user.
  if (!pack) return base(recommendation, 'USER_CHOICE_REQUIRED')

  const resolved = resolvePack(options.catalog, pack)
  if (!resolved.ok) return base(recommendation, 'PACK_UNAVAILABLE', { source, issues: resolved.errors })

  if (!options.company || !options.registry) {
    return base(recommendation, 'REFERENCE_ONLY_NO_COMPANY_SNAPSHOT', { source, packRef: resolved.value.ref })
  }

  const diff = diffPackAgainstCompany(resolved.value, options.company, options.registry, { hash: options.hash })
  return base(recommendation, 'PROPOSAL_READY', {
    source,
    packRef: resolved.value.ref,
    packProposal: buildPackProposal(diff, { includeRecommended: options.includeRecommended === true }),
  })
}
