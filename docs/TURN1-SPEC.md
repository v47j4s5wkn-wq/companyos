# TURN 1 — Architecture & Critique (no code)

---

## 1. Critique of the brief — the blunt part first

**The three-business Phase 1 gate is two phases. Non-negotiable from my side.** The risky machinery — op-log sync, realtime convergence, money correctness, tenant isolation — is *shape-independent*: proving it once on business (a) proves it for all shapes. What the second and third shapes add is UI surface (booking diary, orders/stock views), which is low-risk work that would triple Phase 1's size while adding almost no de-risking. Revised gate: **Phase 1 = §8 points 1–10 for business (a) only**, with the ontology, manifest system, vocabulary engine and capability composer fully in place (so nothing is hardcoded to trades). **Phase 2 = shapes (b) and (c) pass the same gate**, which — if Phase 1's discipline held — is mostly manifest data plus two calendar views and the orders flow. If Phase 2 turns out to need core rewrites, that is the universality claim failing, and we'll know early and cheaply.

**Two of your sections are premature, as you predicted:**

1. **§5.6 staff email is a whole second product.** Inbound mail storage, threading, quota, folder UX, legal-access policy — this is 2–3 months alone, and no tenant will choose you for it in year one; they'll choose you for the operating core. Moved to Phase 5. What Phase 1 *does* ship: all outbound transactional and customer email (invites, proposals, chases, confirmations) through the provider pipe, logged onto the timeline — so "one thread of truth" starts on day one and the mailbox client is added to an already-flowing pipe later. Also: your 5-minute Genesis bar is incompatible with same-session custom-domain sending (DNS propagation alone breaks it) — Phase 1 sends from `{tenant}.companyos.uk` with the tenant's reply-to; custom domain verification is a settings task, not an onboarding blocker.
2. **§5.7 marketing engine (mini-site, review engine, referral tracking)** is Phase 5 and partly buy-not-build. The lead-capture *form* and source attribution stay early (they feed the pipeline, cheap); the hosted mini-site competes with Squarespace on our worst front, and the review engine's "gate unhappy signals" pattern brushes against Google's review-gating policies — needs a compliant design pass before building at all.

**Buy, don't build:** e-signature legality wrapper (typed-signature + IP + hash is fine for proposals; for documents needing qualified signatures, integrate later, don't build), Open Banking (must go through a licensed AISP like TrueLayer/GoCardless-Bank-Account-Data — you cannot touch bank APIs directly; this also adds per-tenant cost, so Phase 4+ and priced in), malware scanning (ClamAV via a scanning service, not homegrown), and WhatsApp Business API (via BSP; costs per conversation — Phase 4).

**Missing from the brief — will hurt in month six if unaddressed:**

- **Backup & disaster recovery:** unstated. Adding: point-in-time recovery on the database, nightly logical backups to separate storage, a tested restore runbook, and per-tenant export doubling as tenant-level backup. A business OS that loses a tenant's ledger is dead.
- **Legal posture as a data processor:** tenants will store *their* customers' personal data in us. We need a DPA (data-processing agreement) in the terms, a subprocessor list, and PECR awareness for any marketing sends (the overdue-chase ladder is fine — contractual; marketing sequences need consent capture). Genesis should capture the tenant's ICO-registration status as an Obligation.
- **MTD honesty:** "MTD-shaped export" is right for VAT bridging. MTD for Income Tax phases in from April 2026 for sole traders over the threshold — the obligations register must model it, but *filing* stays out of scope. Marking `verify this` on all MTD ITSA dates.
- **AI cost governance:** the live generator and receipt extraction cost real money per call. Per-tenant metering and a monthly cap from day one, or a viral week bankrupts you.
- **GBP-only** is nowhere stated. Deciding it: single-currency GBP in Phase 1–3; the minor-units+currency-code schema means multi-currency later is additive.
- **Environments:** one production, one staging, seeded demo tenants in both; CI deploys to staging on merge, production on tag. Unstated in the brief; assumed now.

**One naive spot in §2C:** "a fitter's socket never receives an event about margin, even at the transport layer" is correct as a goal but a single event stream can't serve two permission tiers. Design answer in §7 below: role-tiered event payloads from the outbox (full vs redacted), fanned out on separate channels. It costs write amplification; it's worth it.

Everything else in the brief stands. The ontology claim is sound, the money law is right and rare, and the vocabulary engine is the correct hill to die on.

---

## 2. Stack decision

**Supabase (managed Postgres + RLS + Realtime + Auth + Storage + Edge Functions) with a React/Vite PWA; TypeScript end-to-end; Dexie (IndexedDB) client store; Playwright for E2E.** Reasoning: the brief demands row-level authorisation, realtime, one-person deployability, and near-zero cost at zero users — Supabase is the only mainstream option delivering all four natively; RLS gives data-layer permission enforcement exactly as §2 requires; Realtime (Phoenix channels) gives the §2C transport with channel-authorisation hooks; and everything is plain Postgres, which is the escape hatch: migration path is self-hosted Postgres + a Node API, costing a rewrite of the auth glue and realtime transport (~3–4 weeks) while schema, RLS policies, and data move untouched. Rejected: Firebase (no relational integrity, weak RLS analogue, hostile to the ledger), full custom Node+PG+WebSockets (2 months of undifferentiated plumbing before the first feature), Rails/Hotwire (poor offline story). Known sharp edge, stated per the operating layer: Supabase Realtime's authorisation and fan-out need the outbox design in §7 — naive `postgres_changes` subscriptions cannot do permission-tiered payloads. Verify current Realtime channel limits against pricing tier before Phase 1 build starts (**verify this**).

---

## 3. Ontology schema

Conventions: every tenant-owned table carries `tenant_id uuid not null` (RLS keyed), `id uuid` default v7, `created_at/updated_at`, `deleted_at` (soft delete), and an optimistic `rev int`. Money columns are `bigint` minor units + `currency char(3) default 'GBP'`. All FKs composite-checked against tenant.

**Identity.** `tenants(id, name, slug, vocabulary jsonb, capabilities jsonb, branding jsonb, plan, created_at)` · `users(id, email, name, avatar)` (global) · `memberships(tenant_id, user_id, role_id, status active|deactivated, landing_view)` · `invitations(tenant_id, email, role_id, token_hash, expires_at, accepted_at)` · `roles(tenant_id, name, permissions jsonb, is_owner bool)` — permissions as `["workItem.view.assigned", …]`.

**People.** `contacts(tenant_id, kind person|org, name, email, phone, address jsonb, relationship customer|supplier|other, source, org_id nullable)` — one table, relationship-typed. `contact_merges(winner_id, loser_id, merged_by, at)` for dedupe history.

**Promises.** `leads(tenant_id, contact_id nullable, source, captured jsonb, owner_user_id, status)` · `proposals(tenant_id, contact_id, work_type, status draft|issued|viewed|accepted|declined|expired, version int, supersedes_id, lines jsonb RENDERED, totals jsonb RENDERED {net, vat_by_rate, gross, rounding_method}, valid_until, public_token, accepted {name, ip, at, signature_ref})` — issued proposals immutable by trigger. `price_book_items(tenant_id, name, unit, price_minor, vat_treatment, cost_minor nullable, is_estimate bool, archived)`.

**Work.** `work_items(tenant_id, contact_id, proposal_id, work_type, status, state_machine_ref, assigned user_ids[], site jsonb, price_minor, custom jsonb, warranty_id nullable)` · `work_tasks`, `visits(work_item_id, starts, ends, assignees[], visit_type)` · `variations(work_item_id, description, price_minor, status proposed|approved|declined, approved {sig, at, by}, photos[])` · `snags(work_item_id, description, photo, owner, due, status)` · `timesheets(user_id, work_item_id nullable, start, end, source)` · `checklist_templates(tenant_id, name, sections jsonb)` · `checklist_instances(tenant_id, subject_type, subject_id, template_id, items jsonb [{id, type, label, required, state, value, photo_refs[], by, at}])` — instance items denormalised for offline atomicity.

**Money.** `invoices(tenant_id, contact_id, work_item_id nullable, number int SEQUENTIAL per tenant via counter table, kind deposit|interim|final|order, status draft|issued|part_paid|paid|void, lines jsonb RENDERED, totals jsonb RENDERED, vat_scheme_snapshot, due_date, issued_at)` · `credit_notes(references invoice_id, own sequence)` · `payments(tenant_id, amount_minor, method, received_at, reference)` · `payment_allocations(payment_id, invoice_id, amount_minor)` — the "which invoices did this £500 pay" table. `expenses(tenant_id, supplier_contact_id, amount_minor, vat_minor, category_account_id, allowability full|partial|none, pre_trading bool, work_item_id nullable, receipt_ref, mileage jsonb nullable)` · `accounts(tenant_id, code, name, type)` · `tax_positions(tenant_id, period, kind vat|income_tax|corp_tax, computed jsonb, set_aside_minor)` — materialised nightly + on relevant ops.

**Things.** `products(tenant_id, sku, name, stock_qty, reorder_at, price_minor, cost_minor, variants jsonb)` · `stock_movements(product_id, qty_delta, reason purchase|consumed|adjust|return, work_item_id nullable)` — stock_qty derived from movements, never edited directly. `suppliers` = contacts with relationship supplier. `purchase_orders`, `assets(tenant_id, kind vehicle|equipment, identity jsonb, inspections jsonb, assigned_to)`.

**Obligations.** `obligations(tenant_id, name, due, recurrence rrule, derive_from, source_url, verified_on, status)` · `certifications(tenant_id, user_id, kind, expires, evidence_ref)` · `incidents`, `warranty_records`, `service_plans(contact_id, cadence rrule, price_minor, next_visit)`.

**Conversations (Phase 1 slice).** `threads(tenant_id, contact_id nullable, channel email|sms|internal, subject)` · `messages(thread_id, direction, from, to[], body_ref, template_id nullable, sent_via, message_id_hdr, status queued|sent|bounced)` · `reviews`. Mailbox tables deferred to Phase 5 with the email client.

**Memory & machinery.** `documents(tenant_id, subject_type, subject_id, template_id, version, file_ref, signed jsonb)` · `document_templates` · `activity_events(tenant_id, subject_type, subject_id, kind, summary, actor, at)` append-only · `audit_entries(tenant_id, entity, entity_id, action, before jsonb, after jsonb, actor, at)` append-only, trigger-written · `notifications` · `automations(tenant_id, trigger, condition jsonb, action jsonb, enabled)` · `goals` · `custom_field_defs(tenant_id, entity, key, type, unit, options, required)` + values live in each entity's `custom jsonb`, validated against defs on write · `operation_log` and `event_outbox` — see §7 · `ai_usage(tenant_id, kind, tokens, cost_minor, at)`.

---

## 4. Manifest schema (refined) + worked example

Refinements to the brief's sketch: added `schemaVersion` (validator evolves), `eventTypes` (calendar §5.1 draws from manifest), `stateMachines` (work statuses are manifest data, not code), `landingViews` (role → first screen), and every generated item carries `provenance: curated|generated`. Validator: JSON Schema + semantic checks (every `checklistRef` resolves; every `vatTreatment` ∈ jurisdiction pack's enum; every obligation's `deriveFrom` is a known derivation; price sanity bounds). The validator ships before Genesis.

**Worked example — mobile dog groomer** (deliberately no curated pack; this is what the live generator should produce, shape: field + appointments blend):

```jsonc
{
  "meta": { "name": "Mobile dog grooming", "schemaVersion": 2, "version": 1,
            "verified": false, "generatedBy": "model", "provenance": "generated" },
  "vocabulary": { "workItem": "appointment", "contact": "client", "proposal": "booking",
                  "visit": "visit", "priceBook": "services" },
  "capabilities": { "field": true, "premises": false, "online": false, "goods": false,
                    "time": true, "bookings": true, "stock": true, "vehicles": true,
                    "physicalRisk": false, "food": false, "rota": false,
                    "sensitiveData": false, "construction": false },
  "pipeline": [
    { "stage": "Enquiry", "advanceRequires": ["contact.phone"] },
    { "stage": "Booked", "advanceRequires": ["visit.scheduled", "deposit.optional"] },
    { "stage": "Groomed", "advanceRequires": ["checklist.required.complete"] },
    { "stage": "Paid", "advanceRequires": ["invoice.paid"] } ],
  "stateMachines": { "workItem": ["enquiry","booked","in_progress","complete","paid"] },
  "workTypes": [
    { "name": "Full groom", "checklistRefs": ["groom-standard"], "defaultDurationMins": 90,
      "customFields": ["dogName","breed","coatCondition","behaviourNotes"] },
    { "name": "Puppy intro groom", "checklistRefs": ["groom-puppy"], "defaultDurationMins": 45,
      "customFields": ["dogName","breed","vaccinationChecked"] } ],
  "priceBook": [
    { "name": "Full groom — small breed", "unit": "per visit", "suggestedPriceMinor": 4500,
      "vatTreatment": "standard", "estimate": true, "provenance": "generated" },
    { "name": "De-matting (per 15 min)", "unit": "15 min", "suggestedPriceMinor": 1200,
      "vatTreatment": "standard", "estimate": true, "provenance": "generated" } ],
  "checklists": [
    { "id": "groom-standard", "sections": [
      { "title": "Before", "items": [
        { "type": "photo_required", "label": "Coat condition photo (before)", "required": true },
        { "type": "pass_fail", "label": "Skin check — lumps, parasites", "required": true } ] },
      { "title": "After", "items": [
        { "type": "photo_required", "label": "Finished groom photo", "required": true },
        { "type": "signature", "label": "Owner happy — sign", "required": false } ] } ] } ],
  "customFields": [
    { "entity": "WorkItem", "key": "dogName", "type": "text", "required": true },
    { "entity": "WorkItem", "key": "breed", "type": "select", "optionsRef": "ukBreeds" },
    { "entity": "Contact", "key": "gateCode", "type": "text" } ],
  "eventTypes": [
    { "key": "groom_visit", "label": "Groom", "defaultDurationMins": 90, "colour": "…" },
    { "key": "van_maintenance", "label": "Van service", "internal": true } ],
  "obligations": [
    { "name": "Self Assessment registration", "deriveFrom": "companyType:soleTrader",
      "source": "https://www.gov.uk/register-for-self-assessment", "verifiedOn": "JURISDICTION_PACK" },
    { "name": "Van MOT", "deriveFrom": "flag:vehicles", "recurrence": "yearly" } ],
  "chartOfAccounts": [ { "code": "4000", "name": "Grooming income", "type": "income" },
                       { "code": "5000", "name": "Consumables — shampoo, blades", "type": "cogs" },
                       { "code": "7300", "name": "Van running costs", "type": "expense" } ],
  "commsTemplates": [ { "key": "booking_confirm", "channel": "email|sms", "body": "…" },
                      { "key": "day_before_reminder", "channel": "sms", "body": "…" } ],
  "automations": [ { "trigger": "visit.tomorrow", "action": "send:day_before_reminder" },
                   { "trigger": "workItem.paid", "action": "send:review_request", "enabled": false } ],
  "roles": [ { "name": "Owner", "bundle": "owner" } ],
  "landingViews": { "Owner": "diary" }
}
```

Note what's *not* in it: no tax figure, no threshold, no deadline date — those derive from the jurisdiction pack at seed time, per the brief's hard rule.

---

## 5. Capability-flag → module matrix

| Module | Summoned by | Notes |
|---|---|---|
| Calendar core | always | views vary below |
| Team day-sheet view | crew ∨ rota | |
| Booking diary + online booking | bookings | deposits-to-book optional |
| Map/route view | field | |
| Work workspace | always | sections vary by flags |
| Checklists | always | |
| Money core, VAT, tax set-aside | always | CIS adds when construction |
| Proposals | demand=enquiries | orders flow replaces it when demand=orders |
| Orders/dispatch/returns | goods ∧ online | |
| Stock & suppliers | goods ∨ stock | |
| Shift rota | rota | |
| Timesheets | crew ∨ rota | |
| H&S (RAMS, incidents, toolbox) | physicalRisk | |
| Food hygiene pack | food | |
| GDPR posture pack | sensitiveData | |
| Certification vault | physicalRisk ∨ regulated ∨ food | |
| Fleet | vehicles | |
| Equipment register | equipment | |
| Service plans | subscriptions ∨ recurring | |
| Customer portal | always (content varies) | |
| Comms (outbound + threads) | always | full mailbox = Phase 5 |
| Marketing lead form + attribution | always | mini-site/reviews = Phase 5 |
| Imports | always | |
| Wiki/SOPs, Reporting, Goals, Automations, Search, Notifications | always | |

---

## 6. Permission model — default bundles

Format `entity.action.scope`; scope ∈ own/assigned/team/all. Field gates listed separately; enforcement = RLS row filters + column-gated views + redacted event tier.

- **Owner** (uneditable completeness): `*.*.all` + all field gates + `tenant.settings`, `roles.manage`, `members.manage`, `export.run`, `audit.view`.
- **Office**: contacts/leads/proposals/workItems/invoices/payments/expenses `*.all`; calendar `manage.all`; checklists `manage.all`; stock `manage.all`; documents `manage.all`; reports `view.all`. Field gates: `money.costs.view` yes, `money.margin.view` yes, `people.pay.view` no, `mailbox.personal.access` no. No roles/settings/export.
- **Field**: workItems `view.assigned`, `progress.assigned` (status, checklists, photos, variations-propose, signature-capture); calendar `view.own`; timesheets `create.own`; expenses `create.own`; contacts `view.assigned` (name, site, phone — no financial history). Field gates: none. Cannot see: margin, costs, price book costs, other people's work, pipeline, reports.
- **Manager** (rota shapes): Field + rota `manage.team`, timesheets `approve.team`, workItems `view.team`, holiday `approve.team`.

Access-review screen renders these as sentences ("Dan can see and update the jobs he's assigned to; he cannot see prices' margins or other customers").

---

## 7. Offline sync, op-log, realtime — one system

**Per-entity strategy.**

| Entities | Strategy |
|---|---|
| payments, allocations, invoices (issue/void), stock_movements, work status transitions, checklist required-item ticks, variations approval | **Op-log** — server-authoritative, ordered, idempotent |
| proposals (draft edits), work details, contacts, notes, custom fields | Field-level LWW, server timestamp, `rev` conflict detect → readable diff UI |
| activity_events, audit | append-only, never conflict |
| checklists (non-required ticks, photos) | op-log lite (append ops, no ordering dependency) |

**Op-log.** `operation_log(tenant_id, seq bigserial per tenant, op_id uuid client-generated, kind, payload jsonb, actor, device, applied_at, result)`. Client queues ops in Dexie with `op_id`; server applies in arrival order per entity with business validation (an invoice-issue op re-validates totals server-side); duplicate `op_id` = no-op returning original result (idempotency). Client optimistic state + per-op status chip.

**Event outbox & realtime.** Applying any change appends to `event_outbox(tenant_id, seq, entity, entity_id, kind, payload_full jsonb, payload_redacted jsonb, at)` — **two payload tiers** written at source: `payload_redacted` strips margin/cost/pay fields. Fan-out: Supabase Realtime private channels `tenant:{id}:full` and `tenant:{id}:redacted`, membership checked in the channel-auth hook against role field-gates; per-entity presence channels (`presence:{entity}:{id}`) carry viewing/editing state. **Cursor/replay:** every event carries tenant-monotonic `seq`; client stores last seq; on reconnect requests `events?after=seq` (RLS-filtered, tier-appropriate); gap > 5,000 or > 7 days → full delta resync. Aeroplane-mode return = push op queue → pull gap → converge; the convergence test (two devices, interleaved offline ops, assert identical final state + single audit story) is in CI from Phase 1.

**Photo pipeline.** Dexie blob queue → compress to ~1600px (originals kept until confirmed) → resumable upload to Storage via TUS → server writes `documents` row + outbox event → EXIF (time, GPS) parsed server-side into evidence metadata. Upload queue UI with per-item retry; signed URLs, 15-min expiry, tenant-scoped path.

**Service worker updates:** versioned precache; on new build detected → non-blocking "Update ready" toast → refresh applies; never auto-reload mid-form; kill-switch header forces update past a broken cached build.

---

## 8. Executable test plan (encodes §8)

Playwright E2E against staging, three seeded tenants (field-crew "Brightroof Installations", booking "Chair One Barbers", goods "Wick & Flame Candles" — the third seeded via live generator in the test itself). Suites: **journey-a/b/c.spec** (the ten §8 points as ordered steps; b and c activate at Phase 2); **offline.spec** (`context.setOffline(true)` mid-checklist, complete required photo item, reconnect, assert sync + no dupes via op count); **convergence.spec** (two browser contexts, interleaved offline/online ops, assert state equality + outbox seq continuity); **probe.spec** (API-level: authenticate as tenant A / role Field, replay every route against tenant B IDs and against gated fields — expect 404/absent-field; runs on every merge, failure blocks deploy); **money.property.spec** (property-based: random invoice lines → totals invariant to the stored rounding method, allocations always sum, sequential numbering gapless under concurrent issue); **time.spec** (create 9:00 appointments across 29 Mar 2026 and 25 Oct 2026 boundaries, assert wall-clock stability, RRULE exceptions); **lighthouse.ci** (PWA + performance budgets from §2A as assertions).

---

## 9. Imports & opening balances

Wizard = one engine, four target schemas (contacts, price book/products, open invoices, proposals): upload → header sniff + fuzzy column mapping with confirm → row validation in place → dry-run diff ("create 214, merge 3, skip 2 with reasons") → commit inside a batch id → 24-hour undo = batch soft-delete. Dedupe: normalised email/phone exact + name+postcode trigram candidates → human merge preserving both timelines via `contact_merges`. Opening balances: dated journal entries against a dedicated opening-equity account (debtors, creditors, bank, VAT position, stock qty as adjustment movements) so vitals and tax positions are truthful from day one. Xero/QuickBooks/Google contact exports = shipped mapping presets.

---

## 10. Phase plan

- **P1 — the machine, proven on shape (a):** foundations (envs, CI, probe suite, backup), auth + front door + invites, ontology + manifest validator + vocabulary engine + capability composer, Genesis (1 curated field-trades pack + live generator + Runway), proposals → work → calendar (month/week/day/day-sheet/map) → checklists → money core (ledger, invoices, payments, VAT tracker, set-aside) → offline op-log + realtime/presence → §8 gate for (a). *Everything data-driven; zero trades hardcoding.*
- **P2 — universality proven:** booking diary + online booking + no-shows; orders/stock/dispatch; curated packs 2–5; §8 full three-business gate.
- **P3 — running the company:** customer portal, comms templates + SMS, automations engine + recipes, imports/opening balances, expenses OCR, vitals + basic reports, Stripe payment links.
- **P4 — depth by flags:** H&S pack, certification vault + scheduling refusal, fleet/equipment, service plans + GoCardless, CIS, reporting/goals, notification centre maturity, Open Banking (via AISP).
- **P5 — moat & reach:** staff email platform, marketing engine + mini-site (policy-compliant reviews), WhatsApp, knowledge/training depth, platform billing + plans.

---

## 11. Top five risks

1. **Sync/realtime convergence is the hardest engineering in the product** and it's Phase 1. *Mitigation:* op-log + outbox built and convergence-tested before any module UI; it's the first vertical slice after auth.
2. **Scope relapse** — every module invites its neighbour. *Mitigation:* phase gates you enforce personally; anything not in the current phase is absent from the codebase per §0.3.
3. **Regulatory drift & wrong numbers** — thresholds change; a stale VAT figure harms a real business. *Mitigation:* every figure lives only in the jurisdiction pack with `verifiedOn`; a quarterly review obligation *on ourselves*; UI shows staleness past 12 months; disclaimers as components.
4. **Platform ceiling** — Supabase Realtime limits/pricing or RLS performance at fan-out scale (**verify limits pre-build**). *Mitigation:* outbox decouples us from `postgres_changes`; transport is swappable (self-hosted websocket) without touching the event schema; performance budgets in CI surface degradation early.
5. **Generator embarrassment** — the live generator producing a wrong-headed manifest for an unusual business erodes trust on first contact. *Mitigation:* strict validator + price sanity bounds + item-level `generated` labelling + a 60-second review-and-edit step in Genesis before the workspace seeds + generated packs feed a human curation queue.

---

*STATE.md and DECISIONS.md accompany this file. Awaiting your go — or your pushback — before Turn 2 (design plan).*
