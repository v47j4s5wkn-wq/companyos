import { Link } from 'react-router-dom'
import styles from '../components/ui.module.css'
import { Labelplate } from '../components/Labelplate'

/** The root URL fork, brief §2B: two paths, never a bare login box. */
export function FrontDoor() {
  return (
    <div className={styles.shell}>
      <div className={styles.sheet}>
        <Labelplate>Company OS</Labelplate>
        <p className={styles.hint}>The universal business operating platform.</p>
        <Link to="/get-started" className={styles.buttonLink}>
          I'm starting or running a business
        </Link>
        <Link to="/sign-in" className={styles.buttonGhostLink}>
          I work for a company that uses the Portal
        </Link>
      </div>
    </div>
  )
}
