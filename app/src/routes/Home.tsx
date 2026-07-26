import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth-context'
import { hasPermission } from '../lib/permissions'
import styles from '../components/ui.module.css'
import { Labelplate } from '../components/Labelplate'

/** Role-scoped landing (brief §2B: "no generic empty dashboard for anyone,
 * ever"). The workspace itself — calendar, work, money — doesn't exist until
 * later slices, so the honest empty state here is naming that plainly rather
 * than faking a module. This is a designed empty state, not a stub. */
export function Home() {
  const { currentMembership, signOut } = useAuth()

  if (!currentMembership) {
    return (
      <div className={styles.shell}>
        <div className={styles.sheet}>
          <Labelplate>No company yet</Labelplate>
          <p className={styles.hint}>You're signed in, but not a member of any company.</p>
          <button className={styles.button} onClick={() => void signOut()}>Sign out</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <div className={styles.sheet}>
        <Labelplate trailing={currentMembership.roleName}>{currentMembership.tenantName}</Labelplate>
        <div className={styles.emptyState}>
          <p>The workspace for {currentMembership.tenantName} starts here.</p>
          <p className={styles.hint}>
            Calendar, work, and money ship in later slices — Slice 1 is the front door, accounts, and your team.
          </p>
        </div>
        {hasPermission(currentMembership, 'members.manage') ? (
          <Link to="/team" className={styles.buttonLink}>Manage team</Link>
        ) : null}
        <button className={styles.buttonGhost} onClick={() => void signOut()}>Sign out</button>
      </div>
    </div>
  )
}
