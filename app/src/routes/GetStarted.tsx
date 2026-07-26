import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import styles from '../components/ui.module.css'
import { Labelplate } from '../components/Labelplate'

/** brief §2B "Get started": account creation, then a bare tenant (Genesis is
 * Slice 4). Known gap, disclosed rather than hidden: true "detect an existing
 * account by email and just sign them in" needs a server-side check we haven't
 * built — Supabase's signUp deliberately won't reveal whether an email exists,
 * to prevent enumeration. For now an existing email surfaces Supabase's error
 * with a link to Sign In instead. */
export function GetStarted() {
  const navigate = useNavigate()
  const { refreshMemberships, setCurrentTenantId } = useAuth()
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) {
        setError(signUpError.message)
        return
      }
      if (!signUpData.session) {
        setError('Check your email to confirm your account, then sign in.')
        return
      }

      const { data: tenantId, error: rpcError } = await supabase.rpc('create_tenant', { p_name: companyName })
      if (rpcError) {
        setError(rpcError.message)
        return
      }

      await refreshMemberships()
      setCurrentTenantId(tenantId as string)
      navigate('/home', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.shell}>
      <form className={styles.sheet} onSubmit={handleSubmit}>
        <Labelplate>Get started</Labelplate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="companyName">Company name</label>
          <input
            id="companyName"
            className={styles.input}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            minLength={1}
            maxLength={200}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
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
          {submitting ? 'Creating…' : 'Create my workspace'}
        </button>
        <p className={styles.hint}>
          Already have an account? <Link to="/sign-in">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
