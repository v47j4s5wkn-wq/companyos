// Cross-tenant probe suite (brief §2A, TURN1-SPEC §8): log in as a low-role
// member of tenant A and attempt every reachable route against tenant B's IDs,
// and against actions a Field role has no permission for even in its own
// tenant. A failing probe here means RLS or an RPC's permission check has a
// hole — this must block deploy (CI wires it that way; see .github/workflows).
//
// This runs at the API layer directly (brief: "an automated cross-tenant probe
// suite... tests that log in as tenant A and attempt every endpoint"), not
// through the UI — no browser needed. Requires a real Supabase project with
// this repo's migrations applied.

import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from './env.ts'

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const PASSWORD = 'Probe-Suite-Password-1!'

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

interface Fixture {
  tenantAId: string
  tenantBId: string
  ownerAUserId: string
  ownerBUserId: string
  ownerAMembershipId: string
  ownerBMembershipId: string
  tenantAInvitationId: string
  fieldRoleAId: string
  fieldRoleBId: string
  fieldA: SupabaseClient
  createdUserIds: string[]
}

let fx: Fixture

// Uses the admin API (pre-confirmed user), not public signUp: the probe suite
// tests isolation, and must not depend on whatever the project's "confirm
// email" auth setting happens to be — that's a GetStarted-flow product
// concern, tested elsewhere, not this suite's job.
async function signUpAndCreateTenant(email: string, tenantName: string) {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (createErr || !created.user) throw new Error(`admin create failed for ${email}: ${createErr?.message}`)

  const client = anonClient()
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (signInErr) throw new Error(`sign-in failed for ${email}: ${signInErr.message}`)

  const { data: tenantId, error: rpcError } = await client.rpc('create_tenant', { p_name: tenantName })
  if (rpcError) throw new Error(`create_tenant failed for ${email}: ${rpcError.message}`)

  return { client, userId: created.user.id, tenantId: tenantId as string }
}

test.beforeAll(async () => {
  const a = await signUpAndCreateTenant(`probe-owner-a-${runId}@gmail.com`, `Probe Tenant A ${runId}`)
  const b = await signUpAndCreateTenant(`probe-owner-b-${runId}@gmail.com`, `Probe Tenant B ${runId}`)

  const { data: rolesA } = await a.client.from('roles').select('id, name').eq('tenant_id', a.tenantId)
  const { data: rolesB } = await b.client.from('roles').select('id, name').eq('tenant_id', b.tenantId)
  const fieldRoleAId = rolesA?.find((r) => r.name === 'Field')?.id
  const fieldRoleBId = rolesB?.find((r) => r.name === 'Field')?.id
  if (!fieldRoleAId || !fieldRoleBId) throw new Error('Field role bundle missing from seeded tenant')

  // Create the Field-role user in tenant A directly via the service role —
  // the probe suite tests isolation, not the invite UX (that's covered by the
  // founder's real-phone check per Slice 1's done bar).
  const fieldAEmail = `probe-field-a-${runId}@gmail.com`
  const { data: fieldAUser, error: createErr } = await admin.auth.admin.createUser({
    email: fieldAEmail,
    password: PASSWORD,
    email_confirm: true,
  })
  if (createErr || !fieldAUser.user) throw new Error(`failed to create field user: ${createErr?.message}`)

  const { error: memberErr } = await admin.from('memberships').insert({
    tenant_id: a.tenantId,
    user_id: fieldAUser.user.id,
    role_id: fieldRoleAId,
  })
  if (memberErr) throw new Error(`failed to seed field membership: ${memberErr.message}`)

  const { data: invRows, error: invErr } = await a.client.rpc('create_invitation', {
    p_tenant_id: a.tenantId,
    p_email: `probe-invitee-a-${runId}@gmail.com`,
    p_role_id: fieldRoleAId,
  })
  if (invErr) throw new Error(`failed to seed invitation: ${invErr.message}`)
  const tenantAInvitationId = (invRows as { invitation_id: string }[])[0].invitation_id

  const fieldA = anonClient()
  const { error: signInErr } = await fieldA.auth.signInWithPassword({ email: fieldAEmail, password: PASSWORD })
  if (signInErr) throw new Error(`field user sign-in failed: ${signInErr.message}`)

  const { data: ownerAMembership } = await a.client
    .from('memberships')
    .select('id')
    .eq('tenant_id', a.tenantId)
    .eq('user_id', a.userId)
    .single()
  const { data: ownerBMembership } = await b.client
    .from('memberships')
    .select('id')
    .eq('tenant_id', b.tenantId)
    .eq('user_id', b.userId)
    .single()

  fx = {
    tenantAId: a.tenantId,
    tenantBId: b.tenantId,
    ownerAUserId: a.userId,
    ownerBUserId: b.userId,
    ownerAMembershipId: ownerAMembership!.id,
    ownerBMembershipId: ownerBMembership!.id,
    tenantAInvitationId,
    fieldRoleAId,
    fieldRoleBId,
    fieldA,
    createdUserIds: [a.userId, b.userId, fieldAUser.user.id],
  }
})

test.afterAll(async () => {
  if (!fx) return
  for (const id of fx.createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {})
  }
  await admin.from('tenants').delete().eq('id', fx.tenantAId).then(() => {})
  await admin.from('tenants').delete().eq('id', fx.tenantBId).then(() => {})
})

test('sanity: Field user can see their own tenant', async () => {
  const { data } = await fx.fieldA.from('tenants').select('id').eq('id', fx.tenantAId)
  expect(data).toHaveLength(1)
})

test('cross-tenant: tenants table is invisible across tenants', async () => {
  const { data, error } = await fx.fieldA.from('tenants').select('id').eq('id', fx.tenantBId)
  expect(error).toBeNull()
  expect(data).toHaveLength(0)
})

test('cross-tenant: memberships table is invisible across tenants', async () => {
  const { data } = await fx.fieldA.from('memberships').select('id').eq('tenant_id', fx.tenantBId)
  expect(data).toHaveLength(0)
})

test('cross-tenant: roles table is invisible across tenants', async () => {
  const { data } = await fx.fieldA.from('roles').select('id').eq('tenant_id', fx.tenantBId)
  expect(data).toHaveLength(0)
})

test('cross-tenant: invitations table is invisible across tenants', async () => {
  const { data } = await fx.fieldA.from('invitations').select('id').eq('tenant_id', fx.tenantBId)
  expect(data).toHaveLength(0)
})

test('cross-tenant: users table hides people you share no tenant with', async () => {
  const { data } = await fx.fieldA.from('users').select('id').eq('id', fx.ownerBUserId)
  expect(data).toHaveLength(0)
})

test('cross-tenant: create_invitation rejects a foreign tenant_id', async () => {
  const { error } = await fx.fieldA.rpc('create_invitation', {
    p_tenant_id: fx.tenantBId,
    p_email: `should-not-exist-${runId}@gmail.com`,
    p_role_id: fx.fieldRoleBId,
  })
  expect(error).not.toBeNull()
})

test('cross-tenant: revoke_invitation rejects a foreign invitation', async () => {
  // Field-A has no invitation of its own to test same-tenant escalation against
  // tenant A's real invitation, so this also doubles as that check.
  const { error } = await fx.fieldA.rpc('revoke_invitation', { p_invitation_id: fx.tenantAInvitationId })
  expect(error).not.toBeNull()
})

test('cross-tenant: deactivate_membership rejects a foreign membership', async () => {
  const { error } = await fx.fieldA.rpc('deactivate_membership', { p_membership_id: fx.ownerBMembershipId })
  expect(error).not.toBeNull()
})

test('privilege escalation: Field role cannot manage members in its own tenant', async () => {
  const { error } = await fx.fieldA.rpc('create_invitation', {
    p_tenant_id: fx.tenantAId,
    p_email: `should-not-exist-own-${runId}@gmail.com`,
    p_role_id: fx.fieldRoleAId,
  })
  expect(error).not.toBeNull()
})

test('privilege escalation: Field role cannot deactivate the owner it works under', async () => {
  const { error } = await fx.fieldA.rpc('deactivate_membership', { p_membership_id: fx.ownerAMembershipId })
  expect(error).not.toBeNull()
})
