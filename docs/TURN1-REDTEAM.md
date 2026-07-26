# TURN 1 — RED-TEAM PASS (defects found in my own spec, with corrections)

Read alongside TURN1-SPEC.md; each item amends it. DECISIONS.md D15–D23 log these.

## Defect 1 — "applied in arrival order" is wrong for offline ops (serious)

Arrival order is not causal order. A fitter offline for six hours pushes ops that *arrive* after the office's but *happened* before. For money it's safe (server re-validates every op), but for work-status transitions it produces wrong rejections or wrong acceptances. **Correction:** every op carries client wall-time + the entity `rev` it was made against. The state machine applies with an explicit reconciliation table for status collisions — the two that matter: offline `complete` arriving after office `cancelled` → surfaced as a human conflict card ("Dan finished this job offline, but Amy cancelled it — which stands?"), never auto-resolved; offline progress ops arriving after an office reschedule → auto-accepted (progress is progress). Any collision not in the table is a human card by default. The convergence test suite gains these two cases explicitly.

## Defect 2 — sequential invoice numbers cannot be assigned offline (I implied they could)

Gapless numbering and offline issuance are mutually exclusive. **Correction, stated plainly:** invoice *issue* is a server-side op. Offline, the client prepares the invoice and queues the issue op; the number is assigned when the op applies, and until then the UI says "Invoice will be numbered when back online" — it can be shown to a customer as a total, not sent as a document. This is the honest trade; hiding it would fake a number and break HMRC sequencing.

## Defect 3 — contact relationship as a single column breaks the plumber who buys from you

A contact can be customer *and* supplier *and* referrer. **Correction:** `contact_relationships(contact_id, kind, since)` many-to-many; `contacts.relationship` column deleted from the schema. Dedupe and portal logic key off relationships, not a single kind.

## Defect 4 — deposits-as-liabilities had no mechanism, just a sentence

**Correction:** deposit invoices post to a `deferred income` liability account; a recognition event (work completion, or per-stage for staged invoicing) journals liability → income. `tax_positions` computes revenue from recognised income only, cash from payments — so the vitals "cash" and "revenue" numbers finally mean different, correct things. Cancellations journal the refund/retention split per tenant terms.

## Defect 5 — the redacted realtime tier needs a named component, not a hand-wave

Supabase channel auth answers "may you join," not "may you see this event." **Correction:** the **Outbox Relay** is a first-class service (edge function/worker): tails `event_outbox`, broadcasts each event's correct payload tier to `tenant:{id}:full` / `:redacted` private channels, at-least-once delivery, client dedupes by `seq`. `postgres_changes` is never used for client subscriptions. Relay lag is a monitored metric with a budget (p95 < 300ms).

## Defect 6 — vocabulary engine is not string-swapping (I underspecified it)

"3 jobs" vs "3 appointments," "an appointment" vs "a job," title case in headers, merge fields in templates, and search that matches both the tenant's term and the canonical term. **Correction:** a term service with singular/plural/article forms per term, consumed by UI, templates, documents, and the search indexer (which indexes canonical + tenant term). One module, unit-tested, built in Phase 1 slice 3 — before any screen that names an entity.

## Defect 7 — Phase 1 still carried hidden fat

Cut from P1, moved to P3: drive-time estimates on the map (needs a paid directions API; pins and visit order stay), ICS *import* of external busy-time (ICS *export* stays — it's cheap and loved), and per-customer average-days-to-paid analytics (needs history to mean anything). P1 calendar = month/week/day/day-sheet/agenda + map pins.

## Defect 8 — no cost-of-runway statement (you budget in real pounds)

Zero-user monthly run cost, honest estimate: Supabase Pro ~£20 (PITR needs the paid tier — the backup decision has a price), email provider ~£12 at low volume, domain ~£1, error tracking free tier, Playwright CI free tier. **~£35/month** before AI usage; the live generator adds pennies per onboarding at cap. Verify current pricing at build start (**verify this**).

## Defect 9 — test plan had no unit layer

E2E proves journeys; it's slow and coarse. **Correction:** unit/property tests are required for: the manifest validator (valid/invalid corpus), the vocabulary term service, VAT arithmetic per scheme, payment allocation invariants, RRULE expansion across DST, and the status-reconciliation table from Defect 1. These run in seconds on every commit; E2E runs on merge.

## Also checked and standing (no change)

Public proposal links: 128-bit tokens + rate limiting + expiry — already implied by §2A, now explicit. Custom-field jsonb search: GIN indexes, stated. The Phase 1 regate, email deferral, and stack choice survived a second look — the reasoning holds and no new information weakens it.

*Spec + DECISIONS updated. This is the version to build against.*
