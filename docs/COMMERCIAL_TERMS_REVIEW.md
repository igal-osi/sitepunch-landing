# Commercial pricing and terms review

The Hebrew price-reduction language in `terms.html` and the landing legal modal is
an implementation candidate, not legal or tax advice. Before publishing a price
reduction workflow, SitePunch must obtain review from an Israeli lawyer and an
accountant or tax adviser, including the wording of the customer notice, the
effective-date policy, and the correct credit-document process for any adjustment.

Product safeguards represented by the wording:

- A reduction is communicated to the affected customer by official email before it
  takes effect; it is not represented as an automatic refund.
- The notice (or an agreement) supplies the effective date. The default wording is
  the next renewal boundary.
- Issued invoices and tax documents are historical records and are never edited.
- Any service credit or refund requires an explicit decision and the appropriate
  credit document under applicable law.

The Operations billing system, authoritative customer billing profiles, delivery
outbox, and audit trail live in the application repository. This landing repository
only presents the public terms and consumes the read-only public price catalog.

Canonical commercial terms version: `2026-09-20`. The exact deployed `terms.html`
bytes in this candidate have SHA-256
`db1523117f5f094d40ad9ac0f050fd2f7738d03dbf473b4258a225d5ad8b98f7`.
Changing that file requires a new terms version/hash pair and a coordinated app
release; the price editor is intentionally unable to invent a new legal version.

## Landing catalog contract

The Vercel endpoint `GET /api/commercial-pricing` uses only the server-side
`SUPABASE_URL` plus either `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`.
Do not configure a service-role key for this landing application. It calls the
public RPC `commercial_catalog_get_active`, accepts its real envelope
(`revision_id`, canonical terms version/URL/hash, top-level `currency`, and public rows containing `sku_id`,
`product_id`, `billing_period`, and integer `amount_minor`), and projects the public
plan, Operations, pack and add-on prices used by this landing page. A malformed,
incomplete, missing, or unavailable response serves the committed approved fallback
catalog instead.
