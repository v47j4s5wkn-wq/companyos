import type { ReactNode } from 'react'
import styles from './Labelplate.module.css'

interface LabelplateProps {
  children: ReactNode
  trailing?: ReactNode
}

/** The signature element (TURN2-DESIGN.md): a stamped equipment plate carrying
 * the tenant's word for whatever this screen is. Word comes from the vocabulary
 * layer once it exists (Slice 3); Slice 1 screens pass their canonical name. */
export function Labelplate({ children, trailing }: LabelplateProps) {
  return (
    <header className={styles.plate}>
      <span className={styles.word}>{children}</span>
      {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
    </header>
  )
}
