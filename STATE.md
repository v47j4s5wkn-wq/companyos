# STATE.md — Company OS
Updated: Turn 3, Slice 1 — deployed to staging (Netlify), full invite flow verified end-to-end in a real browser

## Phase: Slice 1 — environments, CI, auth, front door, invitations. Remaining: founder's real-phone test.

## Live staging app: https://companyosbuild.netlify.app
Netlify site `companyosbuild` on the founder's NEW Netlify account (not the API-accessible one — the `companyos-staging` project on the old account is dead, ignore it). Linked to the GitHub repo; every push to `main` auto-builds. Build env vars (VITE_SUPABASE_URL/ANON_KEY) set by the founder in the Netlify UI.

## Verified end-to-end in a browser against the deployed app (2026-07-27)
- Get started → tenant "Brightroof Installations Ltd" created → landed role-scoped as Owner, labelplate carries tenant name.
- Team screen: four role bundles present, invite created (Field, "Dan Mercer"), one-time link shown once, pending list + revoke render.
- Wrong-person guard: owner opening Dan's invite link → "sent to a different email address". Correct.
- New-user acceptance (Edge Function → sign-in → RPC): Dan and Amy both created, landed with correct roles. THREE REAL DEFECTS found and fixed doing this — see DECISIONS D37 and the "defects fixed" list below.
- Office role (Amy) sees no "Manage team"; Field membership (Dan) confirmed via API.
- Probe suite re-run after the RPC change: 11/11 green.

## Decided & delivered
- Turn 1: TURN1-SPEC.md + TURN1-REDTEAM.md (9 defects corrected; D1–D23)
- Turn 2: TURN2-DESIGN.md (worksite-instrument direction, tokens, labelplate signature, Site Mode; D24–D27)
- Phase 1 regated to shape (a) only; shapes (b)(c) = Phase 2 (see DECISIONS D2)

## Slice 1 — built and verified against live staging
- **Toolchain**: Node 22, Supabase CLI 2.109.1, GitHub CLI 2.86 — installed as standalone binaries at `~/Desktop/companyos-toolchain/` (**outside** the repo, see D33). Run `source ~/Desktop/companyos-toolchain/env.sh` to put them on PATH. No Homebrew/Docker in this environment, so no local Supabase stack — all database work goes straight at the hosted staging project.
- **Repo**: `https://github.com/v47j4s5wkn-wq/companyos` — pushed, `main` tracking.
- **App**: Vite + React 19 + TypeScript PWA at `app/`. vite-plugin-pwa (manifest, prompt-based update flow — never auto-reloads mid-form). Dexie installed, unused until Slice 2. TURN2-DESIGN.md tokens as CSS custom properties; Archivo/Public Sans/IBM Plex Mono self-hosted via @fontsource, latin subset only (precache 552KB). Labelplate is the first instance of the signature element.
- **Database** — migrations applied to **staging** (Postgres 17.6): `tenants`, `users` (mirrors `auth.users`), `roles`, `memberships`, `invitations`, `auth_events`. RLS enabled AND forced on every table. Four default role bundles (Owner/Office/Field/Manager) seeded per-tenant by `create_tenant()`, permissions exactly per TURN1-SPEC §6.
- **RPCs** (all security definer, all re-check the caller's rights before writing): `create_tenant` (bare tenant — Genesis is Slice 4), `create_invitation`/`revoke_invitation` (128-bit token, sha256-hashed at rest, 7-day expiry, one live invite per email per tenant), `accept_invitation` (existing-account-joins-another-tenant branch), `deactivate_membership` (offboarding; owner membership protected).
- **Edge Function** `accept-invitation` — **deployed to staging**. Handles the brand-new-account branch of invite acceptance (needs service role for the Auth admin API).
- **Frontend routes**: front door fork, get-started, sign-in, reset-password (request + confirm), accept-invite (both branches, pending-token handoff through sign-in), home (role-scoped, honest empty state), team (invite create/list/revoke, member list).
- **Tests — all green, run for real**: unit (vitest, permission bundles). Probe suite (Playwright, 11 tests) against **live staging**: creates two tenants + a Field-role user, asserts tenants/memberships/roles/invitations/users are invisible across tenants, and that `create_invitation`/`revoke_invitation`/`deactivate_membership` reject both foreign-tenant IDs and same-tenant privilege escalation. Tenant isolation is proven, not assumed.
- **CI** (`.github/workflows/ci.yml`): **green on GitHub.** Lint + typecheck + unit on every PR/push; probe suite on push to `main`, using three secrets on a `staging` GitHub environment (already configured). A failing probe blocks the job, per brief §2A.

## Environments
- **Staging Supabase**: `https://bpkqqyuosnpljxjnhrkl.supabase.co` — migrations + Edge Function live. Anon + service-role keys in `app/.env.local` (gitignored) and in GitHub `staging` environment secrets.
- **Prod Supabase**: `https://ismxghrrnpfunaazllcp.supabase.co` — **empty, no migrations applied.** Deliberate: prod deploys only from tagged releases per CLAUDE.md.
- **Staging hosting**: Netlify project `companyos-staging` created (team `zackashton999`), `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` build env vars set, `netlify.toml` committed. **Not yet deployed** — see blocked list.

## Defects fixed this session (all found by driving the deployed app, not by reading code)
1. Edge Function had no CORS preflight handling — browser never sent the POST. OPTIONS now returns CORS headers.
2. Acceptance logic had two owners (Edge Function duplicated the RPC's membership creation, so the client's follow-up RPC failed on the used invite). RPC is now sole owner + idempotent for same-person re-accept. (D37)
3. Auth context treated all RLS-visible membership rows as "mine" — Amy rendered with the owner's role chip. Now filters by user_id.
4. Dark theme was wired to prefers-color-scheme — auto-dark phones would get dark in sunlight, the exact failure D24 exists to prevent. Dark now requires explicit data-theme.

## Blocked on the founder
1. **The real-phone test — Slice 1's done bar, not yet met**: on a phone, open https://companyosbuild.netlify.app → Get started → create a second tenant → install as PWA → from a desktop, invite yourself (second email) → open the link on the phone → set password → confirm role-scoped landing. Two tenants each with one accepted staff member = Slice 1 done.
2. **Name the product** (D38) — Company OS stays the dev name; shortlist offered: Daybook, Gaffer, Setsquare. Verify domains + UK IPO before committing. Rename is deliberately cheap (four touchpoints).

## Known gaps, disclosed not hidden
- **Invites are not emailed.** The owner copies a link from the Team screen and sends it themselves. No email provider exists yet (D3/D4 put transactional email behind a provider + domain that don't exist at this point in the build). The schema and RPCs don't change when delivery is automated — only "resend" gains a real send. (D30)
- **"Get started" can't detect an existing account by email** (brief §2B). Supabase's `signUp` deliberately won't reveal whether an email is taken (anti-enumeration), so real detection needs a dedicated server-side check. Currently an existing email surfaces Supabase's own error plus a link to Sign In.
- **PWA icons are placeholder** (solid brand plate + "C"). Real branding is a design pass; not blocking.
- **`supabase/config.toml` is committed but not pushed to the hosted project.** It contains local-stack defaults; pushing it wholesale would overwrite hosted auth settings. Treat it as infra-as-code to reconcile deliberately later, not as the current source of truth for staging.
- **react-router-dom 7.18.1** has an open advisory (RSC-mode CSRF bypass) with no patched 7.x release. Not exploitable here — client-only SPA, no RSC/server actions. Revisit when a patch ships.

## Next three steps
1. Founder: real-phone test (steps above) → Slice 1 done.
2. Founder: pick the product name (no build dependency; can run in parallel).
3. Slice 2: `operation_log` + `event_outbox` + Outbox Relay + realtime channels + Dexie offline queue + the convergence test. Highest-risk slice in the project; gets the most tests. The founder's milestone is that convergence test green on two physical phones.

## Verify-this list (unresolved)
- Supabase Realtime channel/connection limits on target pricing tier
- MTD ITSA phase-in dates for obligations register
- Current VAT registration threshold at build time (jurisdiction pack seed)
