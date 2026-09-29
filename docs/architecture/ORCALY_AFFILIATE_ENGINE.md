# Affiliate infrastructure — current state

Status: NOT_STARTED for the new commerce-provider engine. Existing partner referral infrastructure remains operational code under `lib/affiliates` and `/parceiros`; it is not relabeled as Amazon/Mercado Livre product monetization.

The hosted database already contains affiliate profiles, clicks, leads, commissions, referrals, payout items/payouts, achievements, certifications, course progress and activity/audit records. Those tables must be inspected before creating any similarly named entities. Referral commission, marketplace seller payout and third-party product affiliate revenue must remain distinct financial domains.

No Amazon or Mercado Livre product search, price, link-generation, conversion or commission API was invented, queried or advertised as integrated. The supplied product roadmap requires a provider capability contract, canonical ISBN/ASIN/external identity resolver, truthful offer availability and attribution with idempotent conversions. This is pending implementation and provider capability/credential verification.

Future ranking must prioritize fit/relevance/availability/price/reliability ahead of monetization. UI must show a partner-link disclosure before a tracked outbound click. Click tracking must minimize personal data, use allowlisted destinations, and never redirect to arbitrary supplied URLs. Commission states must remain estimated, pending, approved, rejected and paid; pending is not paid. Academy cannot host or generate protected book content without the relevant rights.
