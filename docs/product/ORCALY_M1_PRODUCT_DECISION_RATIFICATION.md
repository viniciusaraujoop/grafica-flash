# ORÇALY — M1 PRODUCT DECISION RATIFICATION

Status: PRODUCT_DECISION_RATIFICATION  
Agent: AGENT 7 — Product Strategy / Solution Design  
Repository: viniciusaraujoop/grafica-flash  
Base challenge SHA: ee35fb9835939b2edd15247ee29aee5fc3de0c26

This document resolves only the product decisions raised by the M1 Architecture Challenge.

It does not authorize implementation, migration creation, database mutation, staging mutation, production mutation, schema design, provider selection, pricing changes, or technical ownership changes.

Already-fixed Coordinator decisions are preserved:

- Orçaly One is a BUNDLE, not an operational product entitlement target.
- Effective entitlement is the union of active valid sources.
- Revoking/cancelling one source must not remove another valid source.
- Entitlement and consent remain separate.
- Cross-product sharing is DENY BY DEFAULT.
- customer_profiles.source_id is not used to backfill future customer identity links.

---

# A. PARTNERS

## DECISION

RESOLVED.

For M1 product semantics, Partners is a USER-SCOPED product.

A Partners entitlement belongs to the authenticated individual who participates in the partner/affiliate program.

affiliate_profiles is an OPERATIONAL PROFILE, not an entitlement source and not an entitlement record.

Its status describes whether the user is operationally eligible to perform partner-specific actions, receive commissions, use affiliate mechanics, or participate in partner workflows.

It must never independently create product access.

The native entitlement provenance for Partners is partner_grant.

Other valid user-scoped entitlement sources may coexist if the product registry later allows them, but affiliate profile status itself never becomes a source.

A valid Partners experience therefore evaluates two separate questions:

1. Does this user have a valid entitlement to Partners?
2. Is this partner/affiliate profile operationally eligible for the requested partner action?

Both may be required for an operational action, but they answer different questions.

Company membership does not automatically create Partners entitlement.

Company-scoped Partners entitlement is NOT part of M1. If Partners later supports partner agencies, partner organizations, or shared partner workspaces, that requires an explicit future product decision rather than reinterpreting the current personal model.

## RATIONALE

The partner relationship belongs to a person in the current product semantics, while affiliate_profiles represents program state.

Combining profile status with product access would make suspension, eligibility, entitlement revocation, and commercial access impossible to reason about independently.

It would also violate the shared-foundation principle that operational status is not entitlement.

## USER EXPERIENCE CONSEQUENCE

- A user with Partners entitlement but an inactive/suspended affiliate profile may enter the Partners surface where appropriate, but partner operations that require active status are blocked with an explicit operational-status explanation.
- A user with an active affiliate profile but no Partners entitlement does not receive product access merely because the profile exists.
- The UI must not describe affiliate status as a subscription or product license.

## ENTITLEMENT / CONSENT CONSEQUENCE

- Entitlement subject: user.
- Native source: partner_grant.
- affiliate_profiles: operational prerequisite only.
- No consent is created by becoming a partner.
- Cross-product data use by Partners still requires matching consent when the use crosses a product/context boundary.

## OPEN QUESTION

None blocking M1.

Future organizational Partners context is explicitly deferred.

---

# B. MARKET

## DECISION

RESOLVED.

Market is a DUAL-CONTEXT product.

It can operate in:

- PERSONAL context; or
- COMPANY context.

The authenticated buyer/actor is always a user.

The BENEFICIARY / INSTALLATION CONTEXT is explicit and may be either that user or a company the user is authorized to represent.

The product must never infer the beneficiary from whichever company happened to be open previously.

### Personal Market context

The user acts for themselves.

Purchases, grants, installations, or entitlements intended for personal-product use attach to the personal/user context.

### Company Market context

The user acts on behalf of a selected company.

Company use requires valid company membership and the operational permission required to purchase/install/manage the Market item.

Any entitlement produced for a company asset belongs to the company context, not to the individual employee who clicked the purchase/install action.

If that employee leaves the company, the company-owned acquisition does not become their personal asset.

### Market browsing versus Market effects

Catalog discovery/browsing may be available more broadly according to future packaging.

Transactional effects such as purchase, install, enable, configure, or grant must always operate against an explicit context.

A Market transaction does not automatically grant access to unrelated products.

A Market item that grants a capability/product/add-on must create the corresponding explicit entitlement through an approved source.

## RATIONALE

Market serves both the individual ecosystem and business ecosystem.

Forcing it to personal-only would make company installations semantically wrong. Forcing it to company-only would make personal products and future personal acquisitions artificial.

The critical distinction is:

ACTOR != BENEFICIARY.

## USER EXPERIENCE CONSEQUENCE

Before a context-sensitive purchase or installation, Market must make the active context clear:

- "For me"; or
- "For Company X".

Switching context changes eligibility, permissions, installed items, and entitlements shown.

A company purchase must not silently become personal if company access disappears.

## ENTITLEMENT / CONSENT CONSEQUENCE

- Market entitlement may be user-scoped or company-scoped depending on the selected context.
- Company context additionally requires membership/operational permission.
- Market purchases can be an entitlement provenance for acquired capabilities/items.
- Market access does not imply consent to expose Business, Wealth, Growth, Academy, Flow, or Partners data to an installed item.
- Any cross-product context transfer remains DENY BY DEFAULT.

## OPEN QUESTION

Commercial packaging of Market browsing, paid items, platform fees, and included assets is COMMERCIAL_REVIEW_REQUIRED, but does not block the M1 subject/context model.

---

# C. ENTITLEMENT SOURCE VOCABULARY

## DECISION

RESOLVED.

The canonical conceptual vocabulary for entitlement provenance is:

1. individual_subscription
2. company_subscription
3. one_bundle
4. trial
5. partner_grant
6. promotion
7. market_purchase
8. admin_grant
9. legacy_migration

Each source has one operational meaning.

### individual_subscription

Access created by a subscription purchased for a personal/user context.

It must not be used for company Business billing.

### company_subscription

Access created by a subscription whose beneficiary is a company/workspace.

Business billing uses this source.

### one_bundle

Access created because Orçaly One includes the target operational product.

One itself is never the target product_id.

Each included product receives its own grant whose provenance points back to the One bundle source reference.

### trial

Explicit time-bounded trial access.

A trial is not inferred from dates elsewhere unless an approved trial issuance rule creates the grant.

### partner_grant

User-scoped access granted because the user participates in the Partners program.

It does not mean affiliate operational status is active.

### promotion

Access granted by a defined promotional campaign or commercial offer.

It requires a stable promotion/source reference and a bounded policy.

### market_purchase

Access created by an explicit purchase/acquisition through Market.

The beneficiary context must be explicit: user or company.

### admin_grant

Exceptional explicit grant created through an authorized platform/admin process.

Support goodwill, complimentary access, internal exceptions, and similar manual cases are reasons/metadata for an admin grant, not new source categories.

### legacy_migration

Grant created only by an approved deterministic migration from a legacy access model.

It is not a normal runtime issuance source.

It must contain provenance sufficient to explain what legacy fact justified the grant.

## REJECTED AS SEPARATE SOURCE CATEGORIES

- complimentary
- support_grant

Reason: these describe why an authorized manual grant was made, not a distinct entitlement provenance mechanism. They belong under admin_grant with an explicit reason.

Generic source values such as manual, other, legacy, or internal are not approved.

## RATIONALE

Source vocabulary must explain how access came into existence.

It must not mix:

- reason;
- subject;
- product state;
- billing state;
- operational role.

Separating personal and company subscriptions also prevents Business billing from being forced into an inaccurately named individual source.

## USER EXPERIENCE CONSEQUENCE

Subscription Center and support tooling can explain access in human terms:

- included with Orçaly One;
- company subscription;
- individual subscription;
- trial;
- partner access;
- promotion;
- Market purchase;
- admin-issued access;
- migrated legacy access.

A user should be able to have multiple valid sources simultaneously without the UI pretending there is only one reason for access.

## ENTITLEMENT / CONSENT CONSEQUENCE

Effective entitlement is the union of all valid grants.

Source vocabulary never creates consent.

Revocation/expiry applies to one source grant without invalidating other valid grants.

## OPEN QUESTION

None blocking M1.

Commercial rules for promotion duration and Market purchases remain owned by the corresponding commercial/product flows.

---

# D. BUSINESS BILLING → ENTITLEMENT

## DECISION

RESOLVED.

A Business subscription creates a COMPANY-SCOPED entitlement with source company_subscription only when the billing domain has an explicit authoritative access-effective commercial state.

Checkout initiation alone does not create entitlement.

### Initial subscription

A new Business subscription becomes entitlement-effective when the commercial/billing system confirms the subscription as activated for a service period.

payment_pending before the first successful activation does NOT provide paid Business entitlement.

If a separate trial exists, access comes from the trial source, not from pretending the pending subscription is active.

### Active paid period

While the subscription is valid for the already-authorized service period, full subscribed access remains valid until the explicit end of that period unless an immediate termination rule applies.

### cancel_at_period_end

cancel_at_period_end does NOT revoke access immediately.

Full entitled access remains available through the already-valid service period.

At the effective period end:

- the subscription no longer provides normal write access;
- another valid entitlement source may continue access;
- READ_ONLY_GRACE may apply according to the separate grace policy.

### payment_pending on renewal

payment_pending does not extend paid write access beyond the period already established as valid.

If renewal is pending while the current paid period is still valid, access remains unchanged through that current period.

After the valid period ends, unresolved payment does not silently create another full-access period.

A configured READ_ONLY_GRACE may apply.

### Billing suspension

Suspension must be an explicit billing/commercial fact with an effective boundary.

A suspension must not be inferred from missing provider data, a timeout, or a failed refresh.

When a subscription is explicitly suspended and the policy requires access suspension, its grant ceases to contribute normal effective access at the explicit effective time.

Other valid entitlement sources remain effective.

### Immediate revocation

Immediate cancellation/termination, refund/chargeback cases that explicitly remove service access, fraud/security action, or another explicit termination event may revoke the subscription-derived access at its defined effective time.

The exact commercial treatment of refund/chargeback is provider/billing policy, not inferred by entitlement.

### Provider/billing outage

Failure to reach the billing provider must not revoke a previously confirmed entitlement before its known valid service boundary.

Unknown provider state is not equivalent to canceled access.

### Restoration

When billing explicitly restores access, entitlement is restored/issued through a deterministic billing event.

No access is inferred merely because an old subscription row still exists.

## RATIONALE

Billing records are facts.

Entitlement is the normalized access contract derived from explicit facts.

The rule must avoid both failure modes:

- granting access too early because payment is merely pending;
- revoking valid access because an external provider is temporarily unavailable.

## USER EXPERIENCE CONSEQUENCE

Subscription Center must communicate distinct states:

- active;
- scheduled to cancel;
- payment pending;
- read-only grace;
- access ended;
- access supplied by another source.

A company with another valid grant, such as One, must not be told it lost Business merely because the company_subscription source ended.

## ENTITLEMENT / CONSENT CONSEQUENCE

- Subject: company.
- Normal source: company_subscription.
- Trial remains an independent source.
- One remains an independent one_bundle source.
- Effective access is the union.
- Billing never creates consent.

## OPEN QUESTION

Exact provider-status-to-commercial-state mapping is implementation/provider research, but the product semantics above are final.

---

# E. GRACE / READ-ONLY ACCESS

## DECISION

RESOLVED.

The ecosystem adopts a conceptual effective-access mode:

READ_ONLY_GRACE

READ_ONLY_GRACE is not a normal paid/full entitlement and does not silently preserve write capability.

It is a bounded continuity state intended to let the user inspect and retrieve existing information while commercial access is being concluded or repaired.

## WHEN IT MAY APPLY

### Cancellation at period end

Full access continues through the paid/valid period.

After that boundary, READ_ONLY_GRACE may apply if the product's commercial policy enables it.

### Inadimplência / unresolved renewal payment

After the previously valid paid period ends, READ_ONLY_GRACE may apply instead of immediate total lockout.

### End of trial

A product may offer READ_ONLY_GRACE after trial expiry.

This is a commercial product policy, not automatic.

### Billing/provider problem

A provider outage does not shorten an already-known valid access period.

If the valid period ends while billing remains unresolved, READ_ONLY_GRACE may be used as the continuity state.

### Downgrade

A plan downgrade does NOT put the whole product in READ_ONLY_GRACE.

The new plan/capability set becomes effective at the defined downgrade boundary.

Capabilities no longer included are blocked according to entitlement/plan rules.

### Immediate termination / abuse / security

READ_ONLY_GRACE is not guaranteed.

Immediate access restriction may bypass grace when explicitly required by security, abuse, legal, or immediate termination policy.

## WHAT READ_ONLY_GRACE ALLOWS

Subject to normal permissions and security:

- open the product;
- read existing records;
- inspect historical data;
- view previously generated reports;
- access Subscription Center;
- export the subject's/company's own data when export is permitted by policy;
- use read-only analytical surfaces, including future Intelligence/Pulse, only when they do not create effects.

## WHAT READ_ONLY_GRACE BLOCKS

- create;
- edit;
- delete;
- submit operational mutations;
- send external communications;
- activate or execute automations that create side effects;
- run operational execution through Intelligence;
- create campaigns;
- change order/payment operational state;
- write through integrations;
- initiate actions that generate new business records;
- bypass a missing entitlement via API.

System operations required for security, billing, integrity, retention, or closing existing in-flight transactions may continue according to domain rules; this does not grant the user write capability.

## DURATION

Grace must be:

- bounded;
- explicit;
- attached to a product/source policy;
- visible to the user;
- never indefinite.

The exact number of days is NOT ratified here.

COMMERCIAL_REVIEW_REQUIRED defines default duration per product/source.

Security/abuse termination may define zero grace.

## RATIONALE

A hard lock immediately after every billing issue creates poor data-access behavior.

Keeping writes indefinitely, on the other hand, makes cancellation meaningless.

READ_ONLY_GRACE gives a clean middle state with understandable product semantics.

## USER EXPERIENCE CONSEQUENCE

The product must clearly show:

- why it is read-only;
- what remains available;
- when grace ends;
- how to restore normal access.

Controls that would mutate data should be disabled or replaced with a clear access-state explanation.

## ENTITLEMENT / CONSENT CONSEQUENCE

Grace affects effective access tier, not consent.

Existing consent is not extended because grace exists.

Consent may still be revoked during grace.

If another full entitlement source exists, effective access remains full regardless of a different source being in grace.

## OPEN QUESTION

Exact grace duration and eligibility by plan/product are COMMERCIAL_REVIEW_REQUIRED and do not block M1 foundation semantics.

---

# F. CONSENT SUBJECT MODEL

## DECISION

RESOLVED.

Consent is modeled around four distinct concepts:

1. AUTHORITY TO GRANT
2. CONSENT CONTEXT SUBJECT
3. SOURCE CONTEXT
4. TARGET CONTEXT

Membership is an authority mechanism, not the consent subject.

## COMPANY-SOURCED DATA

For company-owned operational data:

- consent context subject = company;
- source context = explicit company + source product;
- target context = explicit target product and company/user context as applicable;
- granted_by = authenticated user who possessed the required company authority at grant time.

Example:

Business Company A → Growth Company A

The consent belongs to Company A's context.

An authorized owner/admin may grant it on behalf of the company.

If that user later leaves the company, the consent does not become their personal consent and does not disappear merely because their membership ended.

Authorized current company actors must be able to revoke it.

## PERSONAL-SOURCED DATA

For personal product data:

- consent context subject = user;
- source context = that user's personal product context;
- granted_by = that user, unless a future explicit delegation model exists.

Example:

Wealth personal → Academy personal

The individual owns the decision to grant/revoke the context use.

A company admin cannot grant access to the user's personal Wealth data simply because the person is a member of the company.

## PERSONAL → COMPANY

Example:

Wealth personal → Business Company A

The source is personal, therefore the individual must grant the consent.

The target company must be explicit.

Company membership/target authorization does not substitute for the individual's consent.

## COMPANY → PERSONAL

The source company must have an authorized actor grant the source-context sharing.

Target-product entitlement/access remains a separate requirement.

If the use introduces additional personal-data/privacy obligations, that is PRIVACY/LEGAL_REVIEW_REQUIRED; it must not be inferred from the company grant.

## RATIONALE

The person who clicks "allow" is not always the owner of the context.

Treating membership as the consent subject would make company consent disappear or become orphaned whenever staff changes.

Treating every consent as company consent would improperly let employers authorize use of personal Wealth/Academy data.

## USER EXPERIENCE CONSEQUENCE

Consent screens must say:

- which context is sharing;
- with which product/context;
- for what purpose;
- what categories of data;
- who is authorizing;
- how to revoke.

For company data, the UI should communicate "You are authorizing on behalf of Company X."

For personal data, it should communicate that the authorization belongs to the individual.

## ENTITLEMENT / CONSENT CONSEQUENCE

Valid entitlement on both relevant surfaces remains independently required.

Consent never creates product access.

Membership may determine authority to grant company consent but is not the consent itself.

Revocation authority follows the current subject model:

- personal subject → the user;
- company subject → authorized current company actors.

## OPEN QUESTION

Exact role names allowed to grant/revoke company consent are an operational permission decision and must be reconciled with the canonical company permission model.

This does not block the subject model.

---

# G. CONSENT PURPOSES / SCOPES

## DECISION

RESOLVED.

Consent uses a two-axis controlled taxonomy:

1. DATA SCOPE = WHAT data/context may be used.
2. PURPOSE = WHY it may be used.

Products must not create arbitrary ad hoc purpose strings.

Unknown scope/purpose fails closed.

No hidden wildcard such as all_data or all_purposes is approved for M1.

## DATA SCOPE FAMILIES

Initial extensible families:

- identity.basic
- business.operations
- business.customers
- business.orders
- business.financial
- growth.marketing
- flow.automation
- wealth.financial
- academy.learning
- market.activity
- partners.relationship

A product may define narrower child scopes under these families through the canonical registry.

Financial context is therefore a DATA SCOPE, not a generic purpose.

Education context is represented by academy.learning or a narrower Academy scope, not by an all-purpose "education access" grant.

## PURPOSE VOCABULARY

### contextual_display

Read/display source context inside a target product without broader analytical or action authority.

This is the canonical interpretation of simple cross-product context visibility.

### analytics

Calculate metrics, trends, aggregates, comparisons, or reporting from authorized source data.

Analytics does not imply marketing or operational execution.

### personalization

Adapt the target user's/product's experience using authorized source context.

Personalization does not automatically authorize recommendations, marketing, or execution.

### recommendations

Generate suggestions, prioritization, advice, or proposed next actions.

A recommendation is not permission to execute it.

### automation

Use authorized data as trigger, condition, routing input, or workflow context.

Automation alone does not authorize every external side effect.

The concrete action must still pass action permission and, where required, operational_execution/marketing purpose.

### operational_execution

Use shared context to prepare or perform mutations/actions in another product/context.

This is higher-impact than contextual_display, analytics, or recommendations.

It must be explicit.

### marketing

Use data for marketing audience selection, campaign targeting, promotional communication, lifecycle marketing, or similar marketing activity.

Marketing is never inferred from analytics or personalization.

### education_support

Use authorized context to select or personalize educational guidance/content.

It does not authorize arbitrary use of Academy data by another product.

## PURPOSE COMPOSITION RULES

- contextual_display != analytics
- analytics != personalization
- personalization != recommendations
- recommendations != operational_execution
- automation != marketing
- automation != unrestricted operational_execution
- financial scope does not automatically authorize financial action
- education scope does not automatically authorize profiling outside education_support

A use must match the required scope AND required purpose.

## RATIONALE

The original list mixes contexts, data categories, and reasons for use.

Separating WHAT from WHY keeps consent understandable and extensible without turning it into an infinite ungoverned string list.

## USER EXPERIENCE CONSEQUENCE

Consent UI should describe the concrete result, not internal identifiers.

Example:

"Allow Growth to use Business customer and order data to build marketing audiences."

This maps to:

- source: Business Company A
- target: Growth Company A
- scopes: business.customers + business.orders
- purpose: marketing

A different use, such as analytical reporting, requires its own matching purpose rather than reusing marketing consent.

## ENTITLEMENT / CONSENT CONSEQUENCE

Each consent is bound to:

- subject;
- source product/context;
- target product/context;
- one or more controlled data scopes;
- one or more explicit purposes;
- policy version;
- validity/revocation lifecycle.

Operational actions still require entitlement, permission, and Action Registry policy in addition to consent.

## OPEN QUESTION

Future regulated providers such as Open Finance require their own external/regulatory consent lifecycle and are outside M1.

Adding a new top-level scope family or purpose requires Product + Privacy/Security review.

---

# H. RETENTION POLICY — PRODUCT REQUIREMENTS

## DECISION

RESOLVED.

M1 adopts RETENTION CLASSES rather than pretending one duration fits every record.

No statement below is presented as a legal obligation.

Where legal/compliance duration may apply, LEGAL_REVIEW_REQUIRED is explicit.

## RETENTION CLASS 1 — OPERATIONAL_HISTORY

Purpose:

User-facing history needed to understand recent product activity.

Examples:

- notification history;
- recent read state;
- recent delivery/action outcome.

Conceptual duration:

months, not permanent.

Product target for normal notifications: retain user-visible history for approximately one operational quarter after read/expiry unless a domain needs longer.

Exact physical retention may be tuned operationally.

## RETENTION CLASS 2 — AUDIT_STANDARD

Purpose:

Operational traceability, troubleshooting, and normal accountability.

Examples:

- ordinary row-change audit;
- non-sensitive shared action audit.

Product baseline:

approximately 12 months.

This is a product/security baseline, not a claim of legal necessity.

## RETENTION CLASS 3 — AUDIT_EXTENDED

Purpose:

High-consequence evidence where a short window would undermine access/security/compliance investigation.

Examples:

- entitlement grant/revoke;
- consent grant/revoke/use;
- cross-product access/action;
- privileged admin/security action;
- financial-impact action when applicable.

Conceptual duration:

multi-year, bounded, and not indefinite by default.

Exact duration requires SECURITY_REVIEW and, where applicable, LEGAL_REVIEW.

M1 must preserve the ability to apply a longer retention class without changing event semantics.

## RETENTION CLASS 4 — AGGREGATED_ARCHIVE

After raw operational payload is no longer required, non-identifying/appropriately aggregated metrics may be retained longer for product analytics where purpose and privacy policy allow.

Aggregation must not become a trick for keeping reconstructable personal data forever.

## AUDIT ROW CHANGES

- Default: AUDIT_STANDARD.
- Authorized internal/security users need query access for investigation/support according to role.
- Raw PII should not be copied into shared audit metadata merely to make history easier to read.
- Domain-specific high-consequence row changes may be promoted to AUDIT_EXTENDED.

## AUDIT ACTIONS

- Ordinary low-risk product action: AUDIT_STANDARD.
- Entitlement, consent, cross-product, privileged/security, and financial-impact actions: AUDIT_EXTENDED.
- Shared audit is append-oriented; archival is allowed if authorized investigators can still retrieve retained records when needed.

## NOTIFICATIONS

### Active/unread

Retain while active/actionable.

### Read

Remove from the primary active inbox according to product UX, but preserve in user-visible history for the OPERATIONAL_HISTORY window.

### Expired

At expires_at, the notification is no longer active/actionable.

It may remain visible in history for the OPERATIONAL_HISTORY window with an expired state.

After the history window:

- presentation payload may be purged/archived;
- a separate audit event remains only if the originating action itself requires audit;
- aggregated non-identifying metrics may remain.

A notification row must not be kept forever merely because an audit requirement exists; audit and inbox are different contracts.

## READ STATE

Read state lives no longer than the retained notification/recipient history it describes.

If a read/acknowledgement itself is security-critical, record the appropriate audit action instead of retaining inbox receipt state indefinitely.

For future company broadcast notifications, per-recipient read state must follow the recipient's retained history and must not become a permanent global ledger.

## USER HISTORY REQUIREMENT

Users need access to recent notification history.

Users do NOT require direct visibility into every internal security or row-change audit event.

Authorized owners/admins may receive a product-facing activity history derived from appropriate action audits, but internal security metadata remains restricted.

## ARCHIVE / AGGREGATION

The platform may move older retained audits to archival storage as long as:

- retention semantics remain intact;
- access remains controlled;
- audit integrity is preserved;
- required records remain queryable by authorized roles.

Expired notification payloads may be purged while preserving aggregate counts.

## DELETION / ERASURE

Retention, erasure, statutory preservation, and privacy rights can conflict.

M1 must not invent legal precedence.

LEGAL_REVIEW_REQUIRED defines exceptions where legal/privacy obligations require shorter or longer retention than the product defaults.

## RATIONALE

Notifications, row-level audit, consent evidence, and security actions have very different value lifetimes.

One universal retention number either keeps too much low-value content or deletes high-value evidence too early.

## USER EXPERIENCE CONSEQUENCE

- Active inbox stays focused on current items.
- Users can consult recent notification history.
- Expired items are clearly marked, then eventually leave user-facing history.
- Product/account activity may expose relevant material actions without exposing internal security logs.

## ENTITLEMENT / CONSENT CONSEQUENCE

Expiration or revocation of entitlement/consent does not delete the historical audit evidence of the grant/revoke/use action if its retention class still applies.

Retention of audit evidence does not reactivate access or consent.

## OPEN QUESTION

Exact multi-year retention for AUDIT_EXTENDED requires LEGAL_REVIEW_REQUIRED and SECURITY_REVIEW_REQUIRED before production policy is frozen.

This does not block M1 architecture reconciliation because the required retention class semantics are resolved.

---

# ECOSYSTEM COMPATIBILITY

These decisions are compatible with:

- Business: company_subscription, company consent, read-only grace.
- Wealth: personal entitlement/context and personal consent authority.
- Growth: company cross-product target with explicit purposes/scopes.
- Flow: automation purpose remains distinct from operational execution and marketing.
- Academy: personal education context and education_support purpose.
- Market: explicit personal/company beneficiary context.
- Partners: personal entitlement with operational affiliate status separate.
- One: bundle only, materializing child product grants.

They also preserve compatibility with:

- Product Registry;
- App Hub / Launcher;
- Subscription Center;
- future Pulse and read-only insights;
- future Intelligence recommendations versus execution;
- Automation Recipes;
- Customer Graph;
- Flow.

---

# FINAL RATIFICATION

M1_PRODUCT_RATIFICATION:
APPROVED

PARTNERS:
RESOLVED

MARKET:
RESOLVED

ENTITLEMENT_SOURCE_VOCABULARY:
RESOLVED

BUSINESS_BILLING_ENTITLEMENT:
RESOLVED

GRACE_ACCESS:
RESOLVED

CONSENT_SUBJECT_MODEL:
RESOLVED

CONSENT_PURPOSE_MODEL:
RESOLVED

RETENTION_PRODUCT_REQUIREMENTS:
RESOLVED

IMPLEMENTATION:
NOT_AUTHORIZED

DATABASE_MUTATION:
NONE

READY_FOR_COORDINATOR_RECONCILIATION:
YES

END OF DOCUMENT
