export type MfaAssuranceLevel = 'aal1' | 'aal2' | null

export type SensitiveAction =
  | 'pix.update'
  | 'finance.write'
  | 'subscription.manage'
  | 'team.elevated.manage'
  | 'api_keys.manage'
  | 'data.export'
  | 'platform.impersonation.write'

export type MfaStepUpDecision = {
  allowed: boolean
  required: boolean
  reason: null | 'mfa_enrollment_required' | 'mfa_challenge_required'
}

const STEP_UP_ACTIONS = new Set<SensitiveAction>([
  'pix.update',
  'finance.write',
  'subscription.manage',
  'team.elevated.manage',
  'api_keys.manage',
  'data.export',
  'platform.impersonation.write',
])

export function requiresMfaStepUp(action: SensitiveAction) {
  return STEP_UP_ACTIONS.has(action)
}

export function evaluateMfaStepUp(input: {
  action: SensitiveAction
  hasVerifiedFactor: boolean
  currentLevel: MfaAssuranceLevel
  nextLevel: MfaAssuranceLevel
}): MfaStepUpDecision {
  if (!requiresMfaStepUp(input.action)) {
    return { allowed: true, required: false, reason: null }
  }

  if (!input.hasVerifiedFactor) {
    return {
      allowed: false,
      required: true,
      reason: 'mfa_enrollment_required',
    }
  }

  if (input.currentLevel !== 'aal2') {
    return {
      allowed: false,
      required: true,
      reason: 'mfa_challenge_required',
    }
  }

  return { allowed: true, required: true, reason: null }
}
