import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  notificationMutableByRequester,
  notificationVisibleToRequester,
  notificationVisibilityFilter,
} from '../lib/security/notification-recipient.ts'

const companyA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const companyB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const userA = '11111111-1111-4111-8111-111111111111'
const userB = '22222222-2222-4222-8222-222222222222'

const targetedToA = {
  company_id: companyA,
  user_id: userA,
  status: 'unread',
}

const targetedToB = {
  company_id: companyA,
  user_id: userB,
  status: 'unread',
}

const broadcastA = {
  company_id: companyA,
  user_id: null,
  status: 'unread',
}

const otherCompany = {
  company_id: companyB,
  user_id: userA,
  status: 'unread',
}

// A. Same company, user-targeted visibility is recipient-only.
assert.equal(notificationVisibleToRequester(targetedToA, companyA, userA), true)
assert.equal(notificationVisibleToRequester(targetedToA, companyA, userB), false)

// B. Company-scope notification is visible to both principals.
assert.equal(notificationVisibleToRequester(broadcastA, companyA, userA), true)
assert.equal(notificationVisibleToRequester(broadcastA, companyA, userB), true)

// C. User B cannot mutate User A's notification.
assert.equal(notificationMutableByRequester(targetedToA, companyA, userB), false)

// D. PATCH all=true may affect only requester's targeted rows.
// Broadcast is intentionally immutable until M1E defines per-recipient read semantics.
assert.equal(notificationMutableByRequester(targetedToA, companyA, userB), false)
assert.equal(notificationMutableByRequester(broadcastA, companyA, userB), false)
assert.equal(notificationMutableByRequester(targetedToB, companyA, userB), true)

// E. User A can mutate own notification.
assert.equal(notificationMutableByRequester(targetedToA, companyA, userA), true)

// F. No cross-tenant access.
assert.equal(notificationVisibleToRequester(otherCompany, companyA, userA), false)
assert.equal(notificationMutableByRequester(otherCompany, companyA, userA), false)

// G. Unread count includes only rows visible to requester.
const rows = [targetedToA, targetedToB, broadcastA, otherCompany]
const visibleToA = rows.filter((row) => notificationVisibleToRequester(row, companyA, userA))
const visibleToB = rows.filter((row) => notificationVisibleToRequester(row, companyA, userB))
assert.equal(visibleToA.filter((row) => row.status === 'unread').length, 2)
assert.equal(visibleToB.filter((row) => row.status === 'unread').length, 2)

// Route-level source invariants ensure the service-role query restores both boundaries.
const route = await readFile(
  new URL('../app/api/notifications/route.ts', import.meta.url),
  'utf8',
)

assert.match(route, /\.eq\('company_id', result\.companyAccess!\.company\.id\)\s*\.or\(notificationVisibilityFilter\(result\.requester!\.id\)\)/)
assert.match(route, /\.eq\('company_id', result\.companyAccess!\.company\.id\)\s*\.eq\('user_id', result\.requester!\.id\)/)
assert.equal(route.includes(".update({ status: 'read', read_at: new Date().toISOString() })"), true)
assert.equal(notificationVisibilityFilter(userA), `user_id.is.null,user_id.eq.${userA}`)

console.log('Notification recipient isolation hotfix checks: PASS')
