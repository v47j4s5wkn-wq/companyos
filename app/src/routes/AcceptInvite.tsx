import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import styles from '../components/ui.module.css'
import { Labelplate } from '../components/Labelplate'

const PENDING_TOKEN_KEY = 'companyos.pendingInviteToken'

/** brief §2B: "a staff account is always born from an invitation." Two branches:
 * a brand-new email (set password here, via the accept-invitation Edge Function,
 * which is the only place the service role touches the invite) or an email that
 * already has an account elsewhere (sign in with the existing password, then this
 * page finishes the join with the accept_invitation() RPC — no elevated access
 * needed since the membership insert is authorised by the caller's own JWT). */
export function AcceptInvite() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { session, refreshMemberships, setCurrentTenantId } = useAuth()

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [existingAccountEmail, setExistingAccountEmail] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!session || !token) return
    setJoining(true)
    supabase
      .rpc('accept_invitation', { p_token: token })
      .then(async ({ data: tenantId, error: rpcError }) => {
        if (rpcError) {
          setError(rpcError.message)
          setJoining(false)
          return
        }
        sessionStorage.removeItem(PENDING_TOKEN_KEY)
        await refreshMemberships()
        setCurrentTenantId(tenantId as string)
        navigate('/home', { replace: true })
      })
  }, [session, token, navigate, refreshMemberships, setCurrentTenantId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setError(null)
    setSubmitting(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke<{
        status: 'created' | 'existing_account'
        email?: string
        message?: string
      }>('accept-invitation', { body: { token, password, name } })

      if (fnError) {
        setError(fnError.message)
        return
      }
      if (data?.status === 'existing_account') {
        sessionStorage.setItem(PENDING_TOKEN_KEY, token)
        setExistingAccountEmail(data.email ?? null)
        return
      }
      if (data?.status === 'created' && data.email) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password,
        })
        if (signInError) {
          setError(signInError.message)
        }
        // The auth-state-change listener triggers the effect above, which
        // finishes the join via accept_invitation() and navigates to /home.
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (joining) {
    return (
      <div className={styles.shell}>
        <div className={styles.sheet}>
          <Labelplate>Joining…</Labelplate>
        </div>
      </div>
    )
  }

  if (existingAccountEmail) {
    return (
      <div className={styles.shell}>
        <div className={styles.sheet}>
          <Labelplate>Welcome back</Labelplate>
          <p className={styles.hint}>
            {existingAccountEmail} already has an account. Sign in and this invite will finish joining automatically.
          </p>
          <Link to="/sign-in" className={styles.buttonLink}>Sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <form className={styles.sheet} onSubmit={handleSubmit}>
        <Labelplate>You're invited</Labelplate>
        <p className={styles.hint}>Set your name and a password to join.</p>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="name">Your name</label>
          <input
            id="name"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={styles.button} type="submit" disabled={submitting}>
          {submitting ? 'Joining…' : 'Set password and join'}
        </button>
      </form>
    </div>
  )
}
