# STATE.md — Company OS
Updated: Turn 3, Slice 1 — infrastructure live, probe suite green in CI, staging hosting pending

## Phase: Slice 1 — environments, CI, auth, front door, invitations.

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

## Blocked on the founder
1. **Link Netlify to the GitHub repo** (one-time, browser only — no terminal): app.netlify.com → project `companyos-staging` → Deploys → Build settings → Link repository → GitHub → `v47j4s5wkn-wq/companyos`. It reads `netlify.toml` automatically. After this, every push to `main` auto-deploys and no machine-local upload is ever needed. (Netlify's MCP upload-and-build path failed repeatedly — 400 on large payloads, then persistent 404 even at 1.9MB — so git-based deploys are both the fix and the correct end state.)
2. Once deployed: the real-phone test — two tenants, invite a staff member to each, accept on a physical phone, confirm role-scoped landing and PWA install. That is Slice 1's actual done bar and it is **not yet met**.

## Known gaps, disclosed not hidden
- **Invites are not emailed.** The owner copies a link from the Team screen and sends it themselves. No email provider exists yet (D3/D4 put transactional email behind a provider + domain that don't exist at this point in the build). The schema and RPCs don't change when delivery is automated — only "resend" gains a real send. (D30)
- **"Get started" can't detect an existing account by email** (brief §2B). Supabase's `signUp` deliberately won't reveal whether an email is taken (anti-enumeration), so real detection needs a dedicated server-side check. Currently an existing email surfaces Supabase's own error plus a link to Sign In.
- **PWA icons are placeholder** (solid brand plate + "C"). Real branding is a design pass; not blocking.
- **`supabase/config.toml` is committed but not pushed to the hosted project.** It contains local-stack defaults; pushing it wholesale would overwrite hosted auth settings. Treat it as infra-as-code to reconcile deliberately later, not as the current source of truth for staging.
- **react-router-dom 7.18.1** has an open advisory (RSC-mode CSRF bypass) with no patched 7.x release. Not exploitable here — client-only SPA, no RSC/server actions. Revisit when a patch ships.

## Next three steps
1. Founder links Netlify → GitHub; I verify the deployed staging PWA.
2. Real-phone invite test on two tenants → Slice 1 done.
3. Slice 2: `operation_log` + `event_outbox` + Outbox Relay + realtime channels + Dexie offline queue + the convergence test. Highest-risk slice in the project; gets the most tests. The founder's milestone is that convergence test green on two physical phones.

## Verify-this list (unresolved)
- Supabase Realtime channel/connection limits on target pricing tier
- MTD ITSA phase-in dates for obligations register
- Current VAT registration threshold at build time (jurisdiction pack seed)
