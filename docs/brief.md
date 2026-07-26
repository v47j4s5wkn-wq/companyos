# BUILD BRIEF — "Company OS": the universal business operating platform (PWA)

> Paste this whole document as your first message to Fable 5. Do not ask it to write code in this first turn — the first deliverable is the spec. Build order is at the bottom.

---

## 0. How I want you to work

You are the founding engineer and product architect. I am the founder. Treat this as a real product that real businesses will run their livelihood on, not a demo.

Rules of engagement:

1. **Push back on me.** If a requirement below is wrong, expensive, or a trap, say so and propose the better version. I would rather ship a smaller correct product than a large broken one.
2. **Make decisions.** Where I have left something open, choose, and state the choice with one line of reasoning. Do not hand me a list of options to pick from.
3. **No stubs, no `// TODO: implement`, no fake data pretending to be real logic.** If a module is out of scope for the current phase, say "Phase 3" and leave it out of the codebase entirely rather than half-building it.
4. **Phase gates.** Do not start Phase 2 until Phase 1 is complete, running, and I have said go.
5. Before writing any code in a phase, restate in three sentences what you are about to build and what "done" means. Then build.

---

## 1. Product thesis (read this before anything else)

Most business software fails one of two ways: it is generic (a blank CRM shell that could belong to any company and therefore fits none), or it is vertical (brilliant for dentists, useless for everyone else). Every founder is forced to choose between software that doesn't know their business and software that locks them into someone else's idea of it.

**Company OS refuses the choice. It is built on one claim: underneath the surface, every business on earth is the same machine.** A tattoo studio, a roofing firm, a candle brand, a bookkeeping practice, and a dog groomer all: make promises to people, do work to keep those promises, move money, own things, owe obligations, hold conversations, and accumulate know-how. What differs is vocabulary, emphasis, and rhythm — not structure.

So the architecture is three layers, and this is the whole product in one breath:

1. **A universal ontology** — a small set of primitives every business is made of (defined in §3). The core app is built *only* on these. Nothing industry-specific is ever hardcoded.
2. **A capability composer** — every business is described by a set of capability flags (§4.1): does it visit sites or have premises or live online? Does it sell goods, time, outcomes, or subscriptions? Take bookings? Run shifts? Hold stock? Carry physical risk? Modules and features switch on and off from these flags, so a one-chair barber and a 12-van installer get *different apps* assembled from the same parts.
3. **Archetypes as pure data** — an archetype is a manifest (vocabulary, capability preset, pipeline, seed price book, checklist templates, obligations, chart of accounts) that dresses the primitives in one industry's clothes. Curated packs are hand-verified. **And for any business with no pack, the Genesis Engine writes the manifest live** (§4.3) — meaning the platform serves a falconry school or a drone-survey startup on day one, honestly labelled as generated rather than verified. This is what "universal" means here: not 400 shallow templates, but one deep machine plus a generator.

**The vocabulary engine is non-negotiable:** the UI speaks the tenant's language everywhere. A salon sees *clients* and *appointments*; a builder sees *customers* and *jobs*; a law firm sees *clients* and *matters*; an agency sees *clients* and *projects*. This is a rename layer over the primitives — one place in the code, reflected everywhere including emails, documents, and the customer-facing portal. Software that calls a patient a "lead" has already lost.

**The onboarding is the product.** A founder answers a structured interview and the system *generates their configured workspace* — not a blank slate with an "add your first pipeline stage" empty state. The bar: any founder, any industry, sends a professional, correctly-taxed quote/proposal/booking confirmation to a real customer within five minutes of finishing onboarding, without configuring anything.

### Jurisdiction

UK-first, and genuinely specific: sole trader vs Ltd vs partnership, Companies House incorporation, UTR and Self Assessment, VAT registration threshold and schemes (standard, flat rate, cash accounting, and sector rules like the construction domestic reverse charge — applied only when the capability flags say so), CIS where relevant, PAYE and auto-enrolment, IR35 for services businesses, employers' liability insurance, ICO registration and UKGDPR, Consumer Contracts Regulations 14-day off-premises cancellation rights, food hygiene ratings and Natasha's Law where the flags say food, distance-selling rules where the flags say e-commerce.

Jurisdiction is a swappable pack (same shape as archetypes) so US/EU can come later — but do not build them now, and do not water the UK content down to be "generic enough to extend."

**Hard rule on regulated content:** the app surfaces obligations, deadlines, thresholds and links to primary sources, and *never* states a figure without a source and a `verifiedOn` date. It is an organiser of obligations, not an accountant or solicitor. Every generated legal/tax artefact carries a visible "template — have this reviewed" marker, built as a component, not a footer disclaimer.

---

## 2. Non-negotiable technical constraints

- **Installable PWA.** Real manifest, real service worker, works offline, installs to home screen on iOS and Android, passes Lighthouse PWA audit.
- **Offline-first, not offline-tolerant.** A fitter in a loft, a photographer in a field, a market trader in a signal dead-zone: they must be able to open their work, add photos and notes, complete checklists, take payments-on-account records and signatures. Writes queue locally (IndexedDB as client source of truth) and sync on reconnect. Specify conflict resolution per entity — last-write-wins is fine for most fields, **never** for money, stock, or work status: those need server-authoritative writes or an operation log. Tell me which you chose per entity.
- **Multi-tenant with real authorisation.** One deployment, many companies, strict isolation. Permissions enforced at the data layer (row-level security or equivalent), not by hiding buttons. Assume a disgruntled employee opens devtools.
- **Mobile-first.** Owners on laptops; everyone else one-handed on a phone, often outdoors. Touch targets, thumb reach, daylight legibility are functional requirements.
- **Auditability.** Every mutation to a financial, contractual, or personnel record writes an immutable audit entry: who, what, when, before, after.
- **No data lock-in.** Full tenant export as structured files, on demand, unassisted.
- **Accessibility floor:** keyboard navigable, visible focus, WCAG AA contrast, reduced motion respected, screen-reader-sane labels.

**Stack:** choose it and justify in one paragraph. Must be deployable by one person, cheap at zero users, support row-level authorisation and realtime. State the pick, the escape hatch, and the cost of moving off it.

---

## 2A. Engineering law: budgets, sync mechanics, and the edge cases that kill products

**Performance budgets (hard, tested):** cold start to interactive under 3 seconds on a mid-range Android over 4G; route transitions under 200ms on cached data; local search results under 100ms; a 2,000-customer, 5,000-work-item tenant must feel instant. If a budget is missed, that's a bug, not a backlog item.

**Sync mechanics, precisely:**

- Every client write carries a client-generated UUID and an idempotency key — replaying a queued mutation after a flaky reconnect must never duplicate an invoice, a payment, or a checklist tick.
- Money, stock movements, and work-status transitions go through an **append-only operation log** applied server-side in order; the server is the arbiter, the client shows optimistic state with a subtle "syncing / synced / failed — tap to review" indicator. Everything else may use field-level last-write-wins with server timestamps.
- Conflicts a human must resolve (two people edited the same proposal offline) surface as a readable diff, never a silent overwrite and never a JSON blob.
- **Photo pipeline:** client-side resize/compress (~1600px long edge) with the original retained on-device until confirmed uploaded; EXIF timestamp and GPS preserved — field photos are *evidence*; resumable background upload; instant local thumbnails; a visible per-item upload queue with retry.
- The service worker versioning strategy must guarantee a user is never stranded on a broken cached build: state the update flow (detect → prompt → refresh) explicitly.

**Time law:** store UTC, render in the tenant's timezone; all-day events are dates, not midnight timestamps; recurrence stored as RRULE; the BST/GMT transitions must never shift a 9am appointment to 8am or double-book across the clock change — write tests for the last Sunday of March and October specifically.

**Files & storage:** all file access via short-lived signed URLs scoped to tenant; per-tenant storage quotas with graceful warnings; malware scan on ingest; images/documents inherit the permissions of the entity they're attached to.

**Security posture:** OWASP-grade basics assumed without being asked; an automated **cross-tenant probe suite** runs in CI — tests that log in as tenant A and attempt every endpoint against tenant B's IDs, and as a low-role user against role-gated fields (margin, personal mailboxes). A failing probe blocks deploy. Rate limiting on auth and public endpoints; secrets never in the repo.

**Observability:** structured logs with tenant and user context, an error tracker wired from day one, and a minimal our-side ops console: tenant list, health, storage, error rates, and a lawful, audited support-access mechanism (support access to a tenant requires the owner's consent toggle and is itself logged in that tenant's audit trail).

**Quality bar:** the Phase 1 definition of done (§8) must exist as an *executable* end-to-end test suite — three seeded demo tenants, one per business shape, driven through the full journey in CI including an offline-simulation step. Empty states, loading states, and error states are designed, not defaulted: every list has a first-run invitation, every failure says what happened and what to do.

---

## 2B. The front door: entry, identity & staff access

The very first screen at the root URL is a deliberate fork, not a marketing page and not a bare login box. Two clear paths:

1. **"I'm starting or running a business" → Get started.** Leads into account creation and straight into the Genesis Engine (§4). If they already have a company here, the same path signs them in — detect by email.
2. **"I work for a company that uses the Portal" → Sign in.** Email and password. A staff account only exists because their company invited them — there is **no self-serve staff signup**; a staff account is always born from an invitation and permanently linked to that company.

**Invitation flow (owner/admin side):**

- Enter name, email (or mobile for SMS invite), pick a role — the role determines everything they see from their first second inside.
- Invite carries a one-time expiring link → invitee sets password (and name/photo) and lands scoped to their role: field staff land on today's schedule, front-of-house on the diary, office staff on the pipeline, admins on vitals. No generic empty dashboard for anyone, ever.
- Pending invites visible and revocable; resend/expiry handled; an invite to an email that already exists on another tenant just adds a membership (one human, several companies, a company switcher — supported via `Membership` in §3).

**Auth requirements:**

- Email + strong password with proper reset; optional 2FA (TOTP) that an owner can *require* for admin/finance roles; passkeys if the stack makes them cheap, else Phase 2.
- Sessions that respect real life: long-lived on a personal phone with biometric-gated re-entry via the PWA; short-lived on devices marked shared (a till, a workshop tablet).
- Offboarding is one action: deactivate membership → sessions killed everywhere, mailbox and records retained under company ownership, audit intact. Never delete a human's history because the human left.
- Rate limiting, lockout with owner-visible alerts, every auth event audited.
- The customer portal (§5.5) is a **separate, lighter identity system** — magic-link sign-in for customers, never mixed with staff auth.

---

## 2C. Live everywhere: the realtime multiplayer layer

The Portal is a shared surface, and it must feel like one. When the office moves a job on the calendar, the fitter's phone updates **the same second** — no refresh, no polling, no "pull down to update." This is a feel-of-the-product requirement as much as a technical one: instant propagation is what makes a team trust that the Portal *is* the business rather than a picture of it.

**What "live" means here, precisely:**

- **Every shared view is subscribed, not fetched:** calendars, the pipeline board, work items, checklists, the day sheet, shared mailboxes, vitals. A change lands on every open screen with visibility rights within ~1 second on a normal connection. Target under 500ms server-to-client; measure it.
- **Presence, lightweight and useful, never creepy:** "Amy is viewing this job" as a small avatar on the entity; "Dan is editing this quote" escalates to a soft lock warning on the fields being edited. The email collision detection in §5.6 ("Amy is replying") is this same presence system, not a separate one — build presence once, as a service any module subscribes to.
- **Optimistic UI + authoritative server:** the person who acts sees their change instantly (0ms, local); everyone else sees it on server confirmation. If the server rejects it (permission, conflict, validation), the actor's screen rolls back visibly with the reason — never a silent revert.
- **Collaborative moments that matter:** two people on the calendar see each other's drags in flight; a checklist tick from the field appears on the office screen as it happens (this is how the office watches a job progress in real time without a phone call); a payment recorded at the desk clears the "overdue" badge on the owner's phone mid-glance.
- **Granular, permission-aware channels:** subscriptions are scoped server-side by tenant *and* by the subscriber's permissions — a fitter's socket never receives an event about margin, another team's work, or someone's personal mailbox, even at the transport layer. Realtime must go through the same authorisation as REST; a leaky websocket is a data breach with extra steps.
- **Realtime and offline are one system, not two:** the offline op-log (§2A) and the live event stream are the same ordered truth. Reconnection replays missed events from a cursor (or falls back to a fresh sync past a gap threshold); a device returning from aeroplane mode pushes its queue, pulls the gap, and converges to the same state as everyone else — write the convergence test.
- **Scale sanely:** per-tenant channels, coalesce bursts (a 40-tick checklist import is one digest event, not 40 paints), heartbeat with connection-state UI (a quiet "reconnecting…" pill, never a frozen screen pretending to be live), and battery-respectful behaviour on mobile (background tabs downgrade to push notifications rather than holding sockets).

This is also a stack-selection forcing function: whatever you choose in §2 must make this layer boring to build, and your Turn 1 realtime architecture must state the transport, the event schema, the cursor/replay model, and the presence design.

---

## 3. The universal ontology (core domain model)

Design the full schema before any UI exists. The core primitives — the claim in §1 made concrete — are:

- **Identity:** `Tenant`, `User`, `Membership`, `Invitation`, `Role`, `Permission`
- **People:** `Contact`, `Organisation` (a customer, patient, client, supplier-person — relationship-typed, not duplicated per type)
- **Promises:** `Lead`, `Opportunity`, `Proposal` (renders as quote / estimate / booking / SOW / order per vocabulary), `ProposalLine`, `PriceBookItem`
- **Work:** `WorkItem` — THE central primitive; renders as job / project / order / matter / case / appointment / booking per vocabulary — plus `WorkTask`, `Visit`, `Timesheet`, `ChecklistTemplate`, `ChecklistInstance`, `ChecklistItem`
- **Money:** `Invoice`, `Payment`, `Expense`, `Account` (chart of accounts), `TaxPosition`
- **Things:** `Product`, `StockMovement`, `Supplier`, `PurchaseOrder`, `Asset` (vehicles, tools, chairs, cameras, ovens — with inspection/service dates)
- **Obligations:** `Obligation` (any deadline the state, an insurer, or a certifier imposes), `Certification`, `Incident`, `WarrantyRecord`, `ServicePlan` (any recurring commitment: maintenance visit, retainer, membership, subscription box)
- **Conversations:** `Mailbox`, `EmailMessage`, `Thread` (cross-channel: email/SMS/WhatsApp/call), `Review`
- **Memory:** `Document`, `DocumentTemplate`, `ActivityEvent`, `AuditEntry`, `Notification`, `Automation`, `Goal`, wiki pages

Requirements on the model:

- **Nothing industry-specific in the core.** If you find yourself adding a `roofType` or `chairNumber` column, stop: that's what the archetype-defined **custom field system** is for — typed custom fields (text, number+unit, select, date, boolean, file) declared in manifests, attachable to any primitive, first-class in forms, search, and exports.
- **Money is integers in minor units with a currency code.** Never a float. Ever.
- **Proposals and invoices are immutable once issued.** Changes create a new version with a lineage pointer; store rendered totals and tax breakdown on the document, because the price book will change and last year's invoice must not.
- **`ActivityEvent` is a first-class append-only timeline** attachable to any entity. A customer record reads like a story: enquiry → proposal → chased → won → scheduled → delivered → invoiced → paid → reviewed.
- Soft-delete with retention, never hard delete, for anything a tax authority might want in six years.

### 3.1 The manifest schema (make this concrete in Turn 1)

The archetype manifest is the contract between the core and every industry — curated packs and the live generator both must satisfy it, machine-validated. Its shape, at minimum:

```jsonc
{
  "meta": { "name": "…", "version": 1, "verified": true|false, "generatedBy": null|"model" },
  "vocabulary": { "workItem": "job", "contact": "customer", "proposal": "quote", … },
  "capabilities": { "field": true, "bookings": false, "stock": true, "physicalRisk": true, … },
  "pipeline": [ { "stage": "…", "advanceRequires": ["…"] } ],
  "workTypes": [ { "name": "…", "checklistRefs": […], "customFields": […], "defaultDurationDays": … } ],
  "priceBook": [ { "name": "…", "unit": "…", "suggestedPriceMinor": …, "vatTreatment": "…", "estimate": true } ],
  "checklists": [ … ],                      // full templates, §5.3 item types
  "customFields": [ { "entity": "WorkItem", "key": "…", "type": "number", "unit": "mm", … } ],
  "obligations": [ { "name": "…", "deriveFrom": "vatRegistration|companyType|flag:food|…", "source": "url", "verifiedOn": "date" } ],
  "chartOfAccounts": [ … ],
  "commsTemplates": [ … ],
  "automations": [ … ],                     // seeded recipes
  "roles": [ … ]                            // default role sets by team shape
}
```

Refine this shape, version it, and write the validator before Genesis exists — the generator can only be trusted because the validator is strict.

### 3.2 The permission model

- **Granular permissions, bundled into roles:** a permission is `entity.action.scope` — e.g. `workItem.view.assigned`, `invoice.create.all`, `contact.edit.team`. Scopes: `own` / `team` / `all`. Roles are named bundles; tenants get sensible defaults from the manifest (solo: Owner only; crew: Owner, Office, Field; rota: + Manager) and can clone-and-edit but never edit the Owner role's completeness.
- **Field-level gates** for the sensitive few: `money.margin.view`, `money.costs.view`, `people.pay.view`, `mailbox.personal.access` — enforced in API responses (the field is absent, not blanked client-side).
- **Every permission check happens at the data layer.** The UI reads the same permission set to decide what to render, so the interface and the API can never disagree about what someone may do.
- An **access review screen** for the owner: one page answering "who can see what," in plain language, per person.


---

## 4. The Genesis Engine (the crown jewel — spend your best thinking here)

A structured founder interview that outputs a fully configured, populated, ready-to-trade workspace **for any business whatsoever**.

### 4.1 The capability composer

The interview's real job is to locate the business on a small set of orthogonal axes, and everything else is derived:

- **Where value is delivered:** at customer sites (field) / at your premises / online / shipped
- **What is sold:** goods / time / outcomes-projects / recurring subscriptions-retainers-memberships (multi-select — most businesses are blends)
- **How demand arrives:** enquiries-and-proposals / bookings-appointments / orders-checkout / walk-ins
- **Team shape:** solo / small crew / shift rota / subcontractors
- **Physical dimension:** holds stock? owns vehicles/equipment? physical risk to people (triggers H&S)? perishables/food (triggers hygiene)?
- **Regulatory colour:** regulated profession? certification bodies? construction (CIS/reverse charge)? handles sensitive personal data?

Every module in §5 declares which flags summon it. A solo online candle brand gets stock, orders, dispatch, and distance-selling obligations — and never sees RAMS, day sheets, or a booking diary. A physio gets the diary, no-show handling, sensitive-data posture, and treatment-note templates — and never sees purchase orders. **Same core, different app.** Off-flag modules are absent, not greyed out; and any module can be switched on later from settings as the business evolves, because businesses evolve.

### 4.2 The interview

Adaptive, not a 60-field form; it branches on the axes above. Roughly 12–20 questions, each earning its place: *what you do* → *who buys it* → *how you charge* → *who works with you* → *how you're set up legally* → *what you already have* (existing customers, accounts, insurance, an existing domain for email). Plain language with concrete examples, progress shown, "skip — I'll do this later" on everything non-structural and remembered, never loses an answer to a refresh. The first question is free text — "describe your business in a sentence or two" — and the engine proposes the axis answers from it for the founder to confirm or correct, so a founder who can't classify themselves never gets stuck.

### 4.3 Curated packs + the live generator

- **Curated archetype packs** (hand-verified, shipped as data): start with five deliberately *different-shaped* ones to prove the range — a field-trades business, an appointment-based personal service, a professional-services firm, a product/e-commerce brand, and a food business. Each is a complete manifest: vocabulary map, capability preset, pipeline stages with advance-criteria, seed price book at plausible UK rates (flagged `estimate — set your own price`), proposal/invoice templates with correct tax treatment and the sector's standard inclusions/exclusions, work-type templates with genuine task checklists (real work sequences, not "Step 1: do the job"), role sets sized to headcount, an obligations register with real derived dates, a chart of accounts, and comms templates (acknowledgement, confirmation, proposal covering note, polite chase, firm chase, completion + review request).
- **The live generator:** when no pack fits, the intelligence layer *writes a manifest on the spot* from the interview — vocabulary, pipeline, price book, checklists, obligations — validated against the manifest schema, clearly labelled **generated, not verified** item-by-item, and fully editable. Regulated/tax content in generated packs still comes only from the verified jurisdiction pack; the model never invents a threshold or deadline. A generated manifest that proves popular is the pipeline for creating the next curated pack.
- **Adding curated archetype #6 must never touch core code.** If it does, the architecture has failed.

### 4.4 The Runway

Every new business also gets a **launch plan**: ordered, dependency-aware (you cannot register for VAT before you have a UTR), each item with why it matters, what it costs, how long it takes, and where to do it — a real critical path derived from their legal setup and capability flags, not a flat to-do list. Existing businesses get a shorter "get properly set up here" version instead.

**The bar to clear, restated:** five minutes from finishing onboarding to sending a correct, professional, branded proposal to a real customer — for a plumber, a pilates instructor, and a candle brand alike. If any of the three can't, Genesis has failed.

---

## 5. Operating modules

Deliberately deep. The failure mode I am guarding against is you shipping the *headline* of each module without its guts. Every sub-bullet is a requirement, not an illustration. Industry examples are exactly that — examples; every module must work in every vocabulary its capability flags allow.

### 5.1 Calendar & scheduling (a real system, not a page)

- **Views:** month, week, day, agenda list for phones — plus flag-dependent views: a **team day-sheet** (one column per person, drag work between columns) for crew businesses; a **booking diary** with slot lengths, buffers, and online-booking rules for appointment businesses; a map view with visit order and drive-time estimates for field businesses.
- **Event types are first-class and typed** (drawn from the manifest): site visit, multi-day delivery of work, appointment, class/session with capacity, delivery expected, supplier meeting, internal (training, vehicle service), holiday/absence, personal blocks. Each type has colour, icon, default duration, default checklist.
- **Scheduling intelligence (deterministic, not AI):** double-booking warnings; work scheduled before its materials arrive; person lacks a required, in-date certification; **unscheduled won work** as a backlog tray draggable straight onto the calendar; for booking businesses, no-show tracking and configurable deposit-to-book.
- **Multi-day and partial-team work** representable without hacks (three days, two people days 1–2, one on day 3).
- **Recurrence** with proper exceptions (skip one, edit one, edit series) — for internal events and for recurring service-plan visits.
- **Customer-facing consequences:** moving anything customer-facing offers to send the reschedule message from templates and logs to the timeline. The customer portal shows their appointments and offers "request a change" — a request, never a direct edit. Appointment businesses can expose **public online booking** with rules the owner controls.
- **Two-way ICS feed** per user; import external busy-time so personal life blocks work scheduling.
- Offline: this week's schedule always available with no signal.

### 5.2 Work — the complete workspace for a unit of work

`WorkItem` is the centre of gravity — job, project, order, matter, appointment, whatever the vocabulary says. Opening one shows **everything in one place**, no hunting:

- **Header:** customer, location (tap to navigate) or channel, work type, status, assigned people, dates, agreed price, running cost, live margin (role-gated).
- **Sections:** Overview · Checklists · Schedule & visits · Materials/items · Photos & files · Details (the custom fields from the manifest: measurements for an installer, treatment notes for a therapist, shipment tracking for a brand) · Money (proposal → variations → invoices → payments for *this* work) · Comms log · Notes · Audit.
- **Lineage:** the enquiry it came from, the accepted proposal version, every variation since — one scroll tells the whole story.
- **Variations in the field:** "extra work found" → describe, photograph, price (or flag for office pricing), customer approves on-device with a signature → flows into the final invoice automatically. An unapproved variation visibly blocks completion.
- **Snags/defects** separate from the main checklist: found at handover, each with photo, owner, due date; "complete with snags" spawns scheduled callbacks. (For non-physical work this same engine is the revisions/punch list.)
- **Status is a defined state machine** with per-archetype stages and advance rules. Status never silently skips states.

### 5.3 Checklists — a proper builder, not hardcoded lists

Their own subsystem, used by work, events, assets, and compliance:

- **Template library per tenant**, seeded by Genesis with sector-genuine sequences, plus create/clone/edit/archive.
- **Item types:** simple tick; pass/fail (fail requires note + photo); numeric with units and acceptable range (out-of-range auto-flags); text; photo-required (can't tick without attaching); signature; section header.
- **Composable:** a work type's default checklist = ordered sections from templates; ad-hoc items addable to any live checklist without touching the template.
- **Assignable & accountable:** items assigned to a person; every tick records who and when; a supervisor **countersign** type for the things that matter.
- **Blocking semantics:** required items stop work advancing past "in progress." This is how quality stops being optional.
- **Reusable everywhere:** vehicle walk-arounds, opening/closing routines, fridge temperature logs, end-of-week cash-up — same engine, attached to assets or recurring events.
- Fully offline.

### 5.4 Money — running from day 1, not from first invoice

Starts working **the day the business exists**, when everything is outgoing and there's no revenue — the period when most tools are useless and this one is most valuable.

- **Day-1 ledger:** every pound in or out from the start — formation, tools, equipment, insurance, software — categorised against the chart of accounts, flagged allowable / partially allowable / not allowable, with **pre-trading expenses** tracked correctly as such from the first entry.
- **Expense capture in seconds:** photo of receipt → line items and VAT extracted (AI-assisted, human-confirmed) → categorised → linked to work if work-related. Mileage log at the current HMRC rate feeding cost and tax records.
- **Invoices:** deposit / staged / final against work, or per-order for goods businesses; immutable once issued; credit notes as the only correction path; part-payments; an automatic overdue ladder using comms templates (polite → firm → owner decides). "Average days to get paid" from real payment records, per customer.
- **VAT as the live system it is:**
  - **Pre-registration:** a rolling-12-month taxable-turnover tracker against the threshold, visible from day 1, projecting *when* you'll cross it at run-rate — plus voluntary-registration modelling ("what happens to my prices/margins if I register now").
  - **Post-registration:** every line carries its VAT treatment (standard/reduced/zero/exempt/outside scope — and sector rules like the construction domestic reverse charge, applied only when the flags say so, changing invoice wording correctly); running quarterly VAT position so the bill is never a surprise; scheme-aware arithmetic (standard vs flat-rate vs cash accounting — model each correctly or clearly mark unsupported); return and payment deadlines in obligations; **Making Tax Digital**-shaped digital-records export.
- **Tax set-aside from the first sale:** by structure (sole trader: Income Tax bands + Class 4 NI; Ltd: Corporation Tax + dividend flag), a running **"of the money in your account, this much is not yours"** figure updated with every transaction, with a suggested weekly transfer. Payments on account explained and projected — the year-one double-hit is the classic ambush.
- **CIS where the flags say construction:** deductions both sides, monthly return dates, statements generated.
- **Cashflow projection:** confirmed work, issued invoices at *realistic* pay-dates (their history, not their terms), recurring outgoings, VAT and tax set-asides as scheduled outflows — with stress toggles ("this customer pays 30 days late", "this project slips a month").
- **Accountant handoff:** clean, dated, categorised export. This module reconciles and organises; it does not file. Every HMRC-touching figure carries source + `verifiedOn` per §1.
- **Money law (edge cases you must get right, tested):**
  - **VAT rounding:** pick an HMRC-permitted method (per-line or per-invoice subtotal), apply it consistently, and store which method each issued invoice used — a penny of drift between the lines and the total is a defect.
  - **Invoice numbering is sequential per tenant with no gaps** (HMRC expectation): a voided draft never consumes a number; credit notes get their own sequence and always reference the invoice they correct.
  - **Deposits are liabilities, not income, until earned** — a deposit taken shows in cash but not in revenue, and unwinding a cancelled job (refund, partial retention per the tenant's terms) is a first-class flow, not a manual fudge.
  - **Refunds and part-refunds** reference their payment; customer credit balances exist and can be applied to the next invoice; overpayments don't vanish.
  - **Payment allocation:** a single bank receipt can settle several invoices, and a part-payment allocates explicitly — "which invoice(s) did this £500 pay?" always has a stored answer.
  - Mixed-rate invoices (labour standard-rated, some materials zero-rated) render each rate's subtotal correctly, and the reverse-charge wording appears only on the lines and invoices where the law puts it.

### 5.5 The rest of the operating core

- **Customers & pipeline** — contacts, orgs, enquiry capture, source attribution, stage movement, activity timeline, gone-quiet follow-up prompts. Relationship types from vocabulary (client/patient/customer/member).
- **People** — staff records, roles, right-to-work, certification expiry warnings, timesheets from the field, holiday requests, simple approvals; **shift rota** with published schedules and swap requests where the flags say rota. No payroll calculation — integrate or export.
- **Stock & suppliers** (goods flag) — materials/products, reorder points, supplier price comparison, purchase orders, stock consumed against work so profitability is real; for e-commerce: SKUs, variants, order statuses, dispatch and returns flows.
- **Documents** — generated from templates with merge fields, versioned, e-signature capture, filed against the entity they belong to.
- **Business vitals** — one screen, five numbers an owner should know before breakfast: cash today and projected 30 days (net of tax set-aside), revenue vs same period last year, work sold and undelivered, average days to get paid, proposal win rate. Each number opens its workings. No vanity metrics.
- **Automations** — a small, comprehensible rule engine (when *this*, then *that*), seeded per archetype. Ten well-chosen recipes beats an infinite canvas.
- **Customer portal** — a light magic-link view branded as the *company's*: their proposals, appointments/orders, invoices, documents, change requests. Where a small firm looks unreasonably professional.
- **Proposals/quoting** — build from price book, margin visible to authorised roles only, options a customer can choose between, versioning, public share link, view tracking, accept-online with typed signature and timestamped IP.

### 5.6 The Portal & staff email platform

**Naming and framing:** the whole app is presented to a tenant's team as **their company Portal** — the word working people actually use ("it's on the portal", "log it in the portal"). One login, one place, everything. Customer-facing surfaces stay branded as the *company's* portal, never ours.

**Staff email — a genuinely usable email client, not a contact-log:**

- Every staff member can have a real mailbox at the company's domain (`zack@yourcompany.co.uk`), sending and receiving with anyone in the world. Full compose (rich text, attachments, cc/bcc, branded signatures), inbox, threads, folders/labels, search, drafts, scheduled send.
- **Architecture decision I am imposing — challenge only with a better plan:** do **not** build a mail server. Deliverability, spam, SPF/DKIM/DMARC, blacklists and IMAP storage is a graveyard. Outbound through an email API provider (Postmark/SES class) with guided DNS domain verification (copy-paste records, live checker); inbound via provider inbound-parse into per-user mailboxes in our DB. Connector path: OAuth to existing Google Workspace / Microsoft 365 — same Portal client either way. Tell me storage, threading (RFC 5322 Message-ID/References), and quota model.
- **In-house mail is instant and free:** between `@companydomain` addresses, messages never leave the platform — realtime internal delivery, still normal email threads. Internal distribution lists (all-staff@, office@).
- **Shared mailboxes** (`info@`, `bookings@`, `accounts@`) with assignment, collision detection ("Amy is replying"), unowned-thread alarms — every enquiry is owned or flagged loudly; nothing dies in a personal inbox.
- **The killer integration:** mail to/from a known contact auto-threads onto their record and work timeline; compose-from-anywhere with the proposal attached; templates and merge fields in the composer; proposals/invoices/chases all through this same pipe — one thread of truth.
- **Role-gated:** internal-only or no external mailbox per person, tenant's choice. Personal mailboxes private to the user, with a disclosed, audited owner legal-access process (it's the company's domain; UK employers can lawfully access work email with proper policy — Genesis generates that policy document).
- Deliverability guardrails: enforced verification before external send, per-tenant reputation isolation, bounce/complaint handling that pauses a template and tells the owner why.
- Offline: read cached mail, queue outbound like every other write.

**The rest of the comms hub:** SMS and WhatsApp (Business API) through the same threaded layer — a channel is a plugin. Call logging: number recognised → customer card pops → outcome logged in two taps; missed-call auto-text as a recipe. Internal @mentions and comments **on entities** (this work, this proposal, this customer) — the conversation lives where the work is; @mention fires a Portal notification and (per preference) internal email.

### 5.7 Marketing & growth engine

- **Lead capture:** embeddable enquiry/booking form + a hosted mini-site per tenant (services, photos, reviews, "get a quote" / "book now" per flags) feeding the pipeline with source attribution (Google, Facebook, directories, referral, signage — configurable).
- **Review engine:** on completion + payment, automated review request to Google (and sector platforms), with a gate: unhappy signals route privately to the owner first. Reviews pulled back onto the mini-site and proposals.
- **Referral tracking** with a configurable thank-you workflow.
- **Showcase:** work photos, with customer consent captured at signature/checkout, flow into a gallery for the mini-site and proposals.
- **Proposal follow-up sequences** — the single highest-ROI automation for proposal businesses: configurable cadence, stops on reply or acceptance, "going cold" as a worklist. Equivalent for goods businesses: abandoned-order and repeat-purchase nudges.
- Marketing spend logged by source → **cost per lead and per won customer by channel** from real pipeline data, so "does this directory pay for itself" gets a number.

### 5.8 Safety, compliance & quality (summoned by flags, deep when summoned)

- Physical-risk flag: **RAMS** templates per work type, generated per site, signed by the team on their phones before work starts as a blocking checklist item; toolbox talks with attendance; **incident & near-miss reporting** in a two-minute mobile flow with RIDDOR-reportable types flagged with route and deadline.
- Food flag: hygiene routines on the checklist engine (temperature logs, cleaning schedules), allergen matrix per product (Natasha's Law), EHO-inspection readiness pack.
- Sensitive-data flag: UKGDPR posture — lawful basis records, retention schedules, subject-access export built on the tenant-export machinery.
- **Certification vault** (any flag needing tickets — CSCS, Gas Safe, food hygiene certs, first aid, DBS): expiry warnings at 90/30/7 days, and scheduling refuses (override + audit) to assign people to work requiring a cert they lack.
- **Insurance registry:** policies, cover, renewals, documents — surfaced to customers as a trust signal.
- **Warranty & aftercare:** completed work generates its warranty record; a **service-plan engine** for recurring revenue (maintenance visits, retainers, memberships — auto-scheduled, billed, reminded).

### 5.9 Fleet & asset management (asset flags)

- Vehicles: MOT, tax, service, insurance in obligations; daily walk-arounds (checklist engine); defects; fuel/mileage per vehicle; who's driving what today.
- Equipment & plant: register with photos and serials, assigned to person/vehicle/work, calibration and inspection schedules (PAT, LOLER where relevant), "where is the big SDS drill" answered in one search, loss/theft flow for insurance.

### 5.10 Knowledge, SOPs & training

- A tenant wiki seeded by Genesis with sector-genuine SOPs (how we take an enquiry, how we deliver, how we handle a complaint), editable, versioned, linkable from checklist items ("how to do this step" one tap away in the field).
- Training matrix: role × required skills/certs, gaps visible, completions recorded. New-starter onboarding is a generated checklist: contract, right-to-work, equipment issued, inducted, added to systems.

### 5.11 Reporting & goals

- A report layer over every module: filterable, saveable, exportable (CSV/PDF), schedulable ("email me pipeline every Monday 7am").
- **Goals:** owner sets targets (revenue, work delivered, win rate, review count) by month/quarter; vitals show actual vs target. Honest tracking, nothing gamified.
- P&L view (management-accounts grade, clearly marked as such), work-profitability league table, utilisation, quote-to-cash cycle time.

### 5.12 Integrations & platform

- **Payments:** card links on invoices and checkout (Stripe), Direct Debit for service plans/retainers (GoCardless) — webhooks reconcile automatically.
- **Accounting:** Xero/QuickBooks export first (clean CSV pack), API sync later; **Open Banking feed** via an aggregator so the ledger reconciles against the real bank account.
- **Lookups:** Companies House (verify/autofill), postcode → address, VAT-number validation.
- All integrations optional and degradable; the OS is fully functional with none connected.
- **Notification centre:** every warning in this document (cert expiring, VAT threshold near, proposal gone cold, invoice overdue, MOT due, unowned enquiry) in one prioritised per-user feed with per-type mute — and PWA push.
- **Global search** (⌘K / pull-down): customers, work, proposals, invoices, assets, mail, wiki — one box, instant, offline-capable for cached data.
- **Settings & branding:** logo, colours, numbering formats, default terms, templates, vocabulary overrides — the tenant's identity everywhere a customer looks, and every capability flag switchable as the business evolves.

### 5.13 Data in: imports & switching (existing businesses are half the market)

Genesis already branches for "already trading" — this is the machinery behind that branch:

- **Import wizard** for contacts, price book/products, open invoices, and outstanding proposals: CSV/XLSX upload → column-mapping UI with smart guesses → validation with row-level errors shown in place → **dry-run preview** ("we will create 214 customers, merge 3 duplicates, skip 2 bad rows") → commit with a 24-hour one-click undo.
- **Deduplication** on import and forever after: candidate-duplicate detection (email/phone/name+postcode) with a human merge flow that preserves both histories.
- **Opening balances:** money owed to you, money you owe, bank balance, VAT position mid-quarter, stock on hand — entered once, dated, so day-1-in-the-Portal doesn't pretend the business was born today.
- Direct importers for the obvious sources (a Xero/QuickBooks contact export, a Google Contacts export) are just pre-baked mappings over the same wizard.

### 5.14 The platform's own business (design now, build late)

Company OS is itself a business: tenant subscription billing (Stripe), a free trial that converts, plan tiers gating by seats and modules, dunning for failed payments, and cancellation that triggers the full export offer before anything is ever removed. Design the plan/entitlement model into the schema now so gating is data, not `if` statements sprinkled through the code — but build the billing surface in a late phase; a product with no users doesn't need a paywall, it needs users.

### 5.15 Phasing discipline (because 5.1–5.14 is three years of product)

This full map is the destination, and I want it *designed* for now — the ontology in §3 must accommodate all of it so nothing later requires a rebuild. It is emphatically **not** all Phase 1. In Turn 1, place every module in a phase, defend the ordering by founder value per unit of build cost, and tell me which parts I should buy/integrate rather than build. I expect you to tell me at least two of my sections are wrong or premature.

---

## 6. The intelligence layer

Be precise about what is genuinely AI-driven and what is deterministic. Never use a model where a rule works better; never let a model touch arithmetic.

Model-appropriate: interpreting the founder interview into axis answers and a configuration; **writing generated archetype manifests** (§4.3) within the manifest schema; drafting comms in the firm's voice; summarising a long customer history; receipt photo → line items; "what should I do today" from real state.

Rules-appropriate: every calculation, tax figure, deadline, permission check, and total; all scheduling conflict logic; all state machines.

Requirements: AI features **degrade gracefully** — fully usable with the intelligence layer off or unreachable (curated packs still work; only the live generator needs it). Every generated artefact is editable and marked generated. Nothing generated writes to a financial record without explicit human confirmation. No model output is ever trusted as a number, and regulated content in generated manifests comes only from the verified jurisdiction pack.

---

## 7. Design direction

Not a dashboard template. The people using this are not impressed by SaaS.

Set your own direction and defend it, with these constraints: it must feel like a tool, not a brochure — a well-made instrument, not a marketing site. Legible at arm's length in daylight. Dense where an operator wants density, calm where an owner needs to think. Deliberate typography (real faces chosen with intent, not the default UI sans). One signature element the product is remembered by — and given the thesis, consider making it the visible moment where the universal machine *dresses itself in the tenant's vocabulary and colours*. Then take one accessory off before you ship.

Avoid: cream-plus-serif-plus-terracotta, near-black-plus-acid-green, gradient hero numbers. Defaults, not choices.

Copy is design material, and the vocabulary engine makes it live data: active voice, plain verbs, the tenant's words everywhere. Empty states are invitations. Errors say what happened and what to do, and never apologise.

---

## 8. Definition of done for Phase 1 — proven on THREE different-shaped businesses

Universality is a claim until it survives contact. Phase 1 is done when the same deployed core passes this end-to-end for all three of: **(a)** a field-crew business (e.g. an installer), **(b)** an appointment business (e.g. a one-chair barber or physio), **(c)** a goods business (e.g. an online candle brand) — with (a) exercising the field/offline path in full and (b) and (c) exercising the diary and orders/stock paths.

1. The front door works per §2B: each founder takes "Get started" through Genesis and lands in a workspace configured for *their* business — correct vocabulary, correct modules present, off-flag modules absent. One of the three uses the **live generator** (no curated pack) and still gets a usable, honestly-labelled workspace. Each invites a staff member by email who sets a password via the one-time link and lands scoped to their role; no self-serve staff signup is possible.
2. Each adds a customer and produces the correct promise artefact — a measured quote, a booked appointment with confirmation, an order — from seeded data with correct VAT treatment.
3. Customer-facing acceptance works: quote accepted via public link with signature; booking confirmed; order placed.
4. The promise becomes scheduled/assigned work in the right calendar view for that business shape.
5. **Offline and live (business a):** with aeroplane mode on, the fitter completes the checklist (a required photo-item genuinely blocks completion), attaches photos, records materials, takes a signature; signal returns; it syncs; nothing lost, nothing duplicated — and with two devices online side by side, a change made on one (a calendar drag, a checklist tick, a payment recorded) appears on the other within a second, with presence shown, per §2C.
6. Money flows for all three: invoiced/charged, payment recorded, cashflow and vitals update, profitability correct (materials/stock consumed where relevant), tax set-aside and the rolling VAT-threshold tracker reflect every sale, and a photographed expense lands categorised in the ledger.
7. The audit log tells each story truthfully; scheduling conflicts were checked; state machines never skipped a state.
8. Role isolation holds: a staff member cannot see margin or other tenants' data, and cannot reach either via the API.
9. Installs as a PWA and passes Lighthouse.
10. Each tenant's data exports in full, custom fields included.

If any point fails for any of the three businesses, Phase 1 is not done.

---

## 9. What I want from you, in this order

**Turn 1 — no code.** Deliver: your critique of this brief (what I've got wrong, what's too big, what's missing that will hurt me in month six — and specifically whether the three-business Phase 1 gate is one phase or two); your stack decision with reasoning against the budgets in §2A; the full ontology schema including the custom-field system; the refined **manifest schema (§3.1) plus one complete worked example manifest** for a business of your choosing; the capability-flag → module matrix; your permission model per §3.2 with the default role bundles written out; your offline sync and conflict strategy per entity, including the op-log design, the photo pipeline, and the **realtime architecture per §2C** (transport, event schema, cursor/replay, presence); the executable test plan that encodes §8; the import/opening-balance approach from §5.13; the phase plan; and the top five risks that could kill this, with mitigations. Be blunt.

**Turn 2 — the design plan.** Tokens, type, layout concept, signature element, and how the vocabulary/branding layer manifests visually. Reviewed against the brief and revised where it reads generic, with changes named.

**Turn 3 onwards — build**, one vertical slice at a time, each fully working before the next starts. Foundations and auth first. The ontology and manifest system second. Genesis third. Then proposals, then the calendar/work layer, then money.

Start with Turn 1.
