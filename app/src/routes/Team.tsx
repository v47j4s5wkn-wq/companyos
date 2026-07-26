import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { hasPermission } from '../lib/permissions'
import styles from '../components/ui.module.css'
import { Labelplate } from '../components/Labelplate'

interface RoleOption {
  id: string
  name: string
}

interface MemberRow {
  id: string
  status: string
  users: { name: string | null; email: string } | null
  roles: { name: string } | null
}

interface PendingInvite {
  id: string
  email: string
  name: string | null
  expires_at: string
  roles: { name: string } | null
}

/** Owner/admin side of brief §2B's invitation flow: create, list, revoke. */
export function Team() {
  const { currentMembership } = useAuth()
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [pending, setPending] = useState<PendingInvite[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [issuedLink, setIssuedLink] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!currentMembership) return
    const [rolesRes, membersRes, pendingRes] = await Promise.all([
      supabase.from('roles').select('id, name').eq('tenant_id', currentMembership.tenantId),
      supabase
        .from('memberships')
        .select('id, status, users(name, email), roles(name)')
        .eq('tenant_id', currentMembership.tenantId)
        .returns<MemberRow[]>(),
      supabase
        .from('invitations')
        .select('id, email, name, expires_at, roles(name)')
        .eq('tenant_id', currentMembership.tenantId)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .returns<PendingInvite[]>(),
    ])
    if (rolesRes.data) {
      setRoles(rolesRes.data)
      if (!roleId && rolesRes.data.length > 0) {
        const field = rolesRes.data.find((r) => r.name === 'Field')
        setRoleId(field?.id ?? rolesRes.data[0].id)
      }
    }
    if (membersRes.data) setMembers(membersRes.data)
    if (pendingRes.data) setPending(pendingRes.data)
  }, [currentMembership, roleId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    if (!currentMembership) return
    setError(null)
    setIssuedLink(null)
    setSubmitting(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('create_invitation', {
        p_tenant_id: currentMembership.tenantId,
        p_email: email,
        p_role_id: roleId,
        p_name: name || null,
      })

      if (rpcError) {
        setError(rpcError.message)
        return
      }
      const row = (data as { invitation_id: string; token: string }[] | null)?.[0]
      if (row) {
        setIssuedLink(`${window.location.origin}/accept-invite/${row.token}`)
      }
      setName('')
      setEmail('')
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke(invitationId: string) {
    setError(null)
    const { error: rpcError } = await supabase.rpc('revoke_invitation', { p_invitation_id: invitationId })
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    await load()
  }

  if (!currentMembership || !hasPermission(currentMembership, 'members.manage')) {
    return (
      <div className={styles.shell}>
        <div className={styles.sheet}>
          <Labelplate>Not permitted</Labelplate>
          <p className={styles.hint}>Your role can't manage the team.</p>
          <Link to="/home" className={styles.buttonGhostLink}>Back</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <div className={styles.sheet} style={{ maxWidth: 560 }}>
        <Labelplate trailing={currentMembership.tenantName}>Team</Labelplate>

        <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="inviteName">Name</label>
            <input id="inviteName" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="inviteEmail">Email</label>
            <input
              id="inviteEmail"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="inviteRole">Role</label>
            <select id="inviteRole" className={styles.input} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button className={styles.button} type="submit" disabled={submitting || !email || !roleId}>
            {submitting ? 'Inviting…' : 'Send invite'}
          </button>
        </form>

        {issuedLink ? (
          <div className={styles.field}>
            <p className={styles.hint}>
              Share this link with them — it's shown once and can't be recovered (resend if needed):
            </p>
            <input className={`${styles.input} ${styles.mono}`} readOnly value={issuedLink} onFocus={(e) => e.target.select()} />
          </div>
        ) : null}

        <hr className={styles.rule} />
        <h3 className={styles.label}>Pending invites</h3>
        {pending.length === 0 ? (
          <p className={styles.hint}>Nothing pending.</p>
        ) : (
          pending.map((inv) => (
            <div className={styles.row} key={inv.id}>
              <span>{inv.email} · {inv.roles?.name}</span>
              <button className={styles.buttonDanger} onClick={() => void handleRevoke(inv.id)}>Revoke</button>
            </div>
          ))
        )}

        <hr className={styles.rule} />
        <h3 className={styles.label}>Team</h3>
        {members.map((m) => (
          <div className={styles.row} key={m.id}>
            <span>{m.users?.name ?? m.users?.email} · {m.roles?.name}</span>
            <span className={styles.hint}>{m.status}</span>
          </div>
        ))}

        <Link to="/home" className={styles.buttonGhostLink}>Back</Link>
      </div>
    </div>
  )
}
