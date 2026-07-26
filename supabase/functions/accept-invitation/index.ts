// Accept an invitation for a brand-new user: verifies the token server-side,
// creates a pre-confirmed auth user (admin API — never poke auth.* tables directly),
// then hands off to the accept_invitation() SQL RPC to create the membership.
//
// The "existing user, new tenant" branch does NOT need this function: it's a plain
// authenticated call to accept_invitation() from the client, since no auth user needs
// creating. This function exists only because creating a confirmed user needs the
// service role key, which must never reach the browser.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: { token?: string; password?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const { token, password, name } = body
  if (!token || typeof token !== 'string') return json({ error: 'token required' }, 400)
  if (!password || password.length < 8) {
    return json({ error: 'password must be at least 8 characters' }, 400)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Hash the token the same way create_invitation() did (sha256, hex) to look up
  // the row without ever storing the plaintext token server-side.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const tokenHash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const { data: invitation, error: lookupError } = await admin
    .from('invitations')
    .select('id, tenant_id, email, name, accepted_at, revoked_at, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (lookupError) return json({ error: 'lookup failed' }, 500)
  if (!invitation) return json({ error: 'invitation not found' }, 404)
  if (invitation.accepted_at) return json({ error: 'invitation already accepted' }, 409)
  if (invitation.revoked_at) return json({ error: 'invitation was revoked' }, 410)
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return json({ error: 'invitation has expired' }, 410)
  }

  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('email', invitation.email)
    .maybeSingle()

  if (existing) {
    // Same human, another company: the client must sign in with their existing
    // password, then call accept_invitation(token) directly (authenticated RPC,
    // no service role needed) — this function only handles brand-new accounts.
    return json(
      { status: 'existing_account', message: 'Sign in with your existing account to accept this invite.' },
      200,
    )
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: invitation.email,
    password,
    email_confirm: true,
    user_metadata: { name: name ?? invitation.name ?? null },
  })

  if (createError || !created.user) {
    return json({ error: createError?.message ?? 'account creation failed' }, 400)
  }

  // The new user isn't authenticated yet in this request — accept_invitation()
  // checks auth.uid()/auth.jwt(), so finish the membership creation here instead,
  // as the service role, mirroring exactly what that RPC does.
  const { error: memberError } = await admin.from('memberships').upsert(
    {
      tenant_id: invitation.tenant_id,
      user_id: created.user.id,
      role_id: (
        await admin.from('invitations').select('role_id').eq('id', invitation.id).single()
      ).data?.role_id,
    },
    { onConflict: 'tenant_id,user_id' },
  )
  if (memberError) return json({ error: 'membership creation failed' }, 500)

  await admin.from('invitations').update({ accepted_at: new Date().toISOString() }).eq('id', invitation.id)
  await admin.from('auth_events').insert({
    tenant_id: invitation.tenant_id,
    user_id: created.user.id,
    kind: 'invitation.accepted',
    detail: { invitation_id: invitation.id },
  })

  return json({ status: 'created', email: invitation.email })
})
