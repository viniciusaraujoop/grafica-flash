import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { escapeEmailHtml, extractMailbox, isEmailAddress, mapResendEventStatus, renderTransactionalEmail, verifySvixWebhook } from '../lib/integrations/email/core.ts'

assert.equal(isEmailAddress('cliente@example.com'), true)
assert.equal(isEmailAddress('invalido'), false)
assert.equal(extractMailbox('Orçaly <contato@example.com>'), 'contato@example.com')
assert.equal(escapeEmailHtml('<script>&"'), '&lt;script&gt;&amp;&quot;')
const rendered = renderTransactionalEmail('proposal', { title: '<b>Proposta</b>', cta_url: 'javascript:alert(1)' }, 'Empresa <X>')
assert.ok(rendered.html.includes('&lt;b&gt;Proposta&lt;/b&gt;'))
assert.equal(rendered.html.includes('javascript:'), false)
assert.equal(mapResendEventStatus('email.delivered'), 'delivered')
assert.equal(mapResendEventStatus('email.bounced'), 'bounced')
assert.equal(mapResendEventStatus('contact.created'), null)

const secretBytes = Buffer.from('orcaly-resend-test-secret')
const secret = `whsec_${secretBytes.toString('base64')}`
const id = 'msg_test'
const timestamp = '1000'
const body = '{"type":"email.sent"}'
const signature = createHmac('sha256', secretBytes).update(`${id}.${timestamp}.${body}`).digest('base64')
assert.equal(verifySvixWebhook({ rawBody: body, id, timestamp, signature: `v1,${signature}`, secret, nowMs: 1_000_000 }), true)
assert.equal(verifySvixWebhook({ rawBody: `${body}x`, id, timestamp, signature: `v1,${signature}`, secret, nowMs: 1_000_000 }), false)
assert.equal(verifySvixWebhook({ rawBody: body, id, timestamp, signature: `v1,${signature}`, secret, nowMs: 2_000_000 }), false)
console.log('Orçaly Resend email platform checks: PASS')
