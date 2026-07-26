import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from '../components/ui.module.css'
import { Labelplate } from '../components/Labelplate'

/** Two phases of the same route: request a reset link (no session), then set
 * a new password (Supabase lands the user back here with a recovery session
 * already established via the emailed link). */
export function ResetPasswordRequest() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password/confirm`,
      })
      if (resetError) {
        setError(resetError.message)
        return
      }
      setSent(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className={styles.shell}>
        <div className={styles.sheet}>
          <Labelplate>Check your email</Labelplate>
          <p className={styles.hint}>
            If an account exists for {email}, a reset link is on its way.
          </p>
          <Link to="/sign-in" className={styles.buttonGhostLink}>Back to sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <form className={styles.sheet} onSubmit={handleSubmit}>
        <Labelplate>Reset password</Labelplate>
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
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className={styles.button} type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
        <p className={styles.hint}>
          <Link to="/sign-in">Back to sign in</Link>
        </p>
      </form>
    </div>
  )
}

export function ResetPasswordConfirm() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      navigate('/home', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.shell}>
      <form className={styles.sheet} onSubmit={handleSubmit}>
        <Labelplate>Set a new password</Labelplate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">New password</label>
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
          {submitting ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </div>
  )
}
