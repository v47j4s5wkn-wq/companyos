# STATE.md — Company OS
Updated: Turn 3, Slice 1 in progress (local build complete, not yet deployed)

## Phase: Slice 1 — environments, CI, auth, front door, invitations.

## Decided & delivered
- Turn 1: TURN1-SPEC.md + TURN1-REDTEAM.md (9 defects corrected; D1–D23)
- Turn 2: TURN2-DESIGN.md (worksite-instrument direction, tokens, labelplate signature, Site Mode; D24–D27)
- Phase 1 regated to shape (a) only; shapes (b)(c) = Phase 2 (see DECISIONS D2)

## Slice 1 — built, running locally, not yet verified against live infra
- **Toolchain**: Node 22 + Supabase CLI installed locally under `.toolchain/` (not committed — no Homebrew/Docker in this environment). Run `source .toolchain/env.sh` to put them on PATH.
- **Repo**: git initialised, remote set to `https://github.com/v47j4s5wkn-wq/companyos.git`, not yet pushed (pending your go-ahead).
- **App**: Vite + React 19 + TypeScript PWA at `app/`. vite-plugin-pwa configured (manifest, prompt-based update flow — no auto-reload mid-session). Dexie installed, not yet used (Slice 2). Design tokens from TURN2-DESIGN.md wired as CSS custom properties; Archivo/Public Sans/IBM Plex Mono self-hosted via @fontsource (latin subset only, to keep the PWA precache lean — 552KB). Labelplate component is the first instance of the signature element.
- **Database** (`supabase/migrations/`): `tenants`, `users` (mirrors `auth.users`), `roles`, `memberships`, `invitations`, `auth_events`. UUID v7 ids (hand-rolled function — Supabase's Postgres version isn't guaranteed to have native `uuidv7()` yet). RLS enabled + forced on every table; `pgcrypto`/`citext` pinned to the `extensions` schema and called schema-qualified from every SECURITY DEFINER function, since Supabase installs them there, not `public`. Four default role bundles (Owner/Office/Field/Manager) seeded per-tenant at creation via `create_tenant()`, permissions exactly per TURN1-SPEC §6.
- **RPCs**: `create_tenant` (bare tenant — Genesis is Slice 4), `create_invitation`/`revoke_invitation` (128-bit token, sha256-hashed at rest, 7-day expiry, one live invite per email per tenant), `accept_invitation` (existing-account-joins-another-tenant branch), `deactivate_membership` (offboarding, owner membership protected).
- **Edge Function** (`supabase/functions/accept-invitation/`): handles the brand-new-account branch of invite acceptance (needs the service role to call the Auth admin API — never poke `auth.*` tables directly). Not yet deployed.
- **Frontend routes**: front door fork, get-started (account + bare tenant), sign-in, reset-password (request + confirm), accept-invite (both branches, with a pending-token handoff through sign-in), home (role-scoped, honest empty state — no workspace modules exist yet), team (invite create/list/revoke, member list).
- **Tests**: `app/src/lib/permissions.test.ts` (vitest, green). `app/e2e/probe.spec.ts` (Playwright) — cross-tenant isolation probe: two tenants, a Field-role user, asserts tenants/memberships/roles/invitations/users are invisible across tenants, and that `create_invitation`/`revoke_invitation`/`deactivate_membership` reject both a foreign tenant_id and same-tenant privilege escalation. **Not yet run against a live project.**
- **CI** (`.github/workflows/ci.yml`): typecheck + lint + unit on every PR/push; probe-suite job on push to `main` only (needs `STAGING_SUPABASE_URL`/`STAGING_SUPABASE_ANON_KEY`/`STAGING_SUPABASE_SERVICE_ROLE_KEY` as secrets under a `staging` GitHub environment — not yet configured).
- Locally green: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build` (PWA service worker generates correctly).

## Credentials received this session
- Staging project: `https://bpkqqyuosnpljxjnhrkl.supabase.co` — anon key in `app/.env.local` (gitignored).
- Prod project: `https://ismxghrrnpfunaazllcp.supabase.co` — anon key received, not yet wired anywhere (no prod env file exists yet; prod deploys only from tagged releases per CLAUDE.md).
- GitHub repo created: `v47j4s5wkn-wq/companyos`, remote wired, not yet pushed.

## Blocked on the founder (in order)
1. Run `.toolchain/supabase login` in a separate terminal (keeps the access token off this session entirely) — then I can `link` + `db push` the migrations and deploy the Edge Function to staging.
2. Add the three secrets above to a GitHub `staging` environment so the probe-suite CI job can run.
3. Confirm before I push the initial commit to GitHub (visible/shared-state action).
4. Once migrations are live: run the probe suite for real, do the two-tenant real-phone invite test, deploy staging as an installable PWA — that's Slice 1's actual done bar, not yet met.

## Known gaps, disclosed not hidden
- "Get started" detecting an existing account by email (brief §2B) isn't implemented — Supabase's `signUp` deliberately won't reveal whether an email is taken (anti-enumeration), so true detection needs a dedicated server-side check. For now an existing email surfaces Supabase's own error with a link to Sign In. Revisit if this friction bothers real users.
- PWA icons are placeholder (solid brand colour + "C" mark) — real branding is a design pass, not blocking.
- react-router-dom 7.18.1 has an open advisory (RSC-mode CSRF bypass) with no patched 7.x release yet; irrelevant to us — this is a client-only Vite SPA, no server actions/RSC in play. Revisit if a patched version ships.

## Next three steps
1. Founder: `supabase login`, add GitHub `staging` environment secrets, confirm push.
2. Me: link staging project, `db push` migrations, deploy the Edge Function, run the probe suite for real, fix anything it finds.
3. Two real tenants + one real-phone invite each, staging PWA install check, then Slice 1 is actually done — proceed to Slice 2 (op-log + outbox relay).

## Verify-this list (unresolved)
- Supabase Realtime channel/connection limits on target pricing tier
- MTD ITSA phase-in dates for obligations register
- Current VAT registration threshold at build time (jurisdiction pack seed)
