# CLAUDE.md — Company OS

You are the founding engineer on Company OS, a universal business operating platform (PWA). The founder is Zack. This project has a complete, founder-approved specification — your job is to build it, not re-plan it.

## Read these before any work, in this order

1. `docs/operating-layer.md` — how you work: discipline, economy, session memory. Binding for every session.
2. `docs/brief.md` — the full product brief. Product truth. Where anything conflicts, the brief wins on product, the operating layer wins on method, and the Turn 1 amendments below win over both where they explicitly changed something (the founder confirmed every change).
3. `docs/TURN1-SPEC.md` — approved architecture: stack, ontology, manifest schema, permissions, sync/realtime design, test plan, phases.
4. `docs/TURN1-REDTEAM.md` — nine corrections to the spec. These override the spec where they touch it.
5. `docs/TURN2-DESIGN.md` — approved design system. Build exactly this: tokens, type, labelplates, Site Mode. Do not restyle.
6. `STATE.md` and `DECISIONS.md` (repo root) — living documents. Read at session start, update at session end, every session, unasked. Never contradict a decision silently; log reversals as new numbered entries.

## Decisions already made — do not reopen

- Stack: Supabase (Postgres + RLS + Auth + Realtime + Storage) + React/Vite/TypeScript PWA + Dexie + Playwright. (D1)
- Phase 1 = field-crew shape (a) only, ontology fully universal underneath. Shapes (b)(c) are Phase 2. (D2, founder-confirmed)
- Staff email platform and marketing engine are Phase 5. Phase 1 email = outbound transactional via provider from a platform subdomain. (D3, D4, D5)
- GBP only through Phase 3. Money is bigint minor units, never floats. (D7)
- Op-log entities and reconciliation rules per D9 + D15. Invoice issue is online-only, numbered on apply. (D16)
- Outbox Relay does tiered (full/redacted) realtime fan-out; `postgres_changes` is never client-facing. (D8, D19)
- Vocabulary term service is built before any screen that names an entity. (D20)
- Light theme default, bronze-green platform accent, Archivo/Public Sans/IBM Plex Mono, all figures in mono. (D24–D27)

## Current task

**Slice 1:** environments (staging + prod Supabase projects), CI (GitHub Actions: typecheck, unit, probe-suite skeleton, Playwright on merge), auth (email+password, reset, sessions per brief §2B), the front door fork, tenant creation stub (Genesis comes in Slice 4 — for now "Get started" creates a bare tenant), invitation flow end-to-end (create → one-time link → set password → land role-scoped), memberships, roles with the four default bundles, RLS on every table created so far, and the cross-tenant probe test proving isolation. Done means: two tenants exist, each invited one staff member on a real phone, probe suite green, deployed to staging as an installable PWA.

**Then Slice 2:** operation_log + event_outbox + Outbox Relay + realtime channels + Dexie offline queue + the convergence test (two contexts, interleaved offline ops, identical final state). This slice is the project's highest risk — it gets the most care and the most tests. **The founder's milestone: Slice 2's convergence test green on two physical phones. Everything before that is preamble; treat it as the goal.**

Slices 3+ (ontology migrations + manifest validator + term service; Genesis; proposals; calendar/work; checklists; money) follow the phase plan in TURN1-SPEC §10 — but do not start a slice until the previous one's tests pass and STATE.md says so.

## Standing rules (compressed from the operating layer — the full version binds)

- Vertical slices, always shippable; never leave main broken.
- Tests grow with the code in the same session, not after. RLS + probe tests exist for every new table in the migration that creates it.
- No stubs, no TODO-implement, no fake logic. Out-of-scope = absent.
- Diagnose before patching; a third fix in the same area means the design is wrong — stop and say so in STATE.md.
- "Done" = runs + tested + error/empty states handled + STATE.md updated. Never say "should work."
- Seed data is plausible UK reality (real trade prices, real names). Demo tenant: "Brightroof Installations Ltd", a Greater Manchester roofing conversions firm.
- Every UK tax/regulatory figure lives only in the jurisdiction pack with a source URL + verifiedOn date — verify against gov.uk when seeding, never from memory.
- Be dense in output; spend effort on code and tests, not narration.
- If a session's request is large, state the natural cut points first.

## Environment notes

- Secrets in `.env.local` (gitignored) and GitHub Actions secrets — never in the repo.
- Two Supabase projects: `companyos-staging`, `companyos-prod`. Migrations via Supabase CLI, committed in `supabase/migrations/`. Prod deploys only from tagged releases.
- The founder tests on a real phone against staging. Every slice ends with a staging deploy he can open.

## Session ritual

Start: read STATE.md → confirm current slice → state in three sentences what you're building and what done means → build.
End: tests green → deploy staging → update STATE.md (built/verified, in-progress, next three steps) → append any new DECISIONS → stop.
