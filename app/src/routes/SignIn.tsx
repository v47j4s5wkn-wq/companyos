import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from '../components/ui.module.css'
import { Labelplate } from '../components/Labelplate'

/** brief §2B: staff sign-in only. No self-serve staff signup exists — a staff
 * account is always born from an invitation (see AcceptInvite). */
export function SignIn() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message)
        return
      }
      const pendingToken = sessionStorage.getItem('companyos.pendingInviteToken')
      navigate(pendingToken ? `/accept-invite/${pendingToken}` : '/home', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.shell}>
      <form className={styles.sheet} onSubmit={handleSubmit}>
        <Labelplate>Sign in</Labelplate>
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
            autoComplete="current-password"
          />
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={styles.button} type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className={styles.hint}>
          <Link to="/reset-password">Forgot your password?</Link>
        </p>
        <hr className={styles.rule} />
        <p className={styles.hint}>
          Starting a business? <Link to="/get-started">Get started</Link>
        </p>
      </form>
    </div>
  )
}
