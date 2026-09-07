import assert from 'node:assert/strict'
import {
  companyPermissionAllowed,
  evaluateFeatureAccess,
} from '../lib/access-control-core.ts'

const base = {
  role: 'funcionario',
  isAdminMaster: false,
  canManage: false,
  canFinance: false,
  canConfig: false,
  canProducts: false,
  canProposal: false,
  canSubscription: false,
  canProduction: false,
}

const owner = {
  ...base,
  role: 'dono',
  canManage: true,
  canFinance: true,
  canConfig: true,
  canProducts: true,
  canProposal: true,
  canSubscription: true,
  canProduction: true,
}

const manager = {
  ...base,
  role: 'gerente',
  canManage: true,
  canFinance: true,
  canProducts: true,
  canProposal: true,
  canSubscription: true,
  canProduction: true,
}

assert.equal(companyPermissionAllowed(base, 'orders.read'), true, 'employee should read orders in own tenant')
assert.equal(companyPermissionAllowed(base, 'finance.read'), false, 'employee must not read finance')
assert.equal(companyPermissionAllowed(manager, 'automations.manage'), true, 'manager can manage automations when entitlement/flag allow it')
assert.equal(companyPermissionAllowed(owner, 'team.manage'), true, 'owner can manage team')

const allTrue = evaluateFeatureAccess({
  actorCompanyId: 'company-a',
  targetCompanyId: 'company-a',
  permissionAllowed: true,
  entitlementAllowed: true,
  featureFlagAllowed: true,
})
assert.deepEqual(allTrue, { allowed: true, deniedBy: [] })

assert.deepEqual(
  evaluateFeatureAccess({
    actorCompanyId: 'company-a',
    targetCompanyId: 'company-a',
    permissionAllowed: false,
    entitlementAllowed: true,
    featureFlagAllowed: true,
  }).deniedBy,
  ['permission'],
)

assert.deepEqual(
  evaluateFeatureAccess({
    actorCompanyId: 'company-a',
    targetCompanyId: 'company-a',
    permissionAllowed: true,
    entitlementAllowed: false,
    featureFlagAllowed: true,
  }).deniedBy,
  ['entitlement'],
)

assert.deepEqual(
  evaluateFeatureAccess({
    actorCompanyId: 'company-a',
    targetCompanyId: 'company-a',
    permissionAllowed: true,
    entitlementAllowed: true,
    featureFlagAllowed: false,
  }).deniedBy,
  ['feature_flag'],
)

assert.deepEqual(
  evaluateFeatureAccess({
    actorCompanyId: 'company-a',
    targetCompanyId: 'company-b',
    permissionAllowed: true,
    entitlementAllowed: true,
    featureFlagAllowed: true,
  }).deniedBy,
  ['tenant'],
  'cross-company access must fail closed by default',
)

assert.equal(
  evaluateFeatureAccess({
    actorCompanyId: 'company-a',
    targetCompanyId: 'company-b',
    allowCrossCompanyAdmin: true,
    permissionAllowed: true,
    entitlementAllowed: true,
    featureFlagAllowed: true,
  }).allowed,
  true,
  'explicit privileged cross-company context may be permitted by the server wrapper',
)

console.log('Orçaly 3.1 access-control checks: PASS')
