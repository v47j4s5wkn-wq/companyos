import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Membership } from './types'

interface AuthState {
  session: Session | null
  memberships: Membership[]
  currentMembership: Membership | null
  loading: boolean
  setCurrentTenantId: (tenantId: string) => void
  refreshMemberships: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

const CURRENT_TENANT_KEY = 'companyos.currentTenantId'

type MembershipRow = {
  id: string
  tenant_id: string
  role_id: string
  status: 'active' | 'deactivated'
  landing_view: string | null
  tenants: { name: string; slug: string } | null
  roles: {
    name: string
    permissions: string[]
    field_gates: Record<string, boolean>
    landing_view: string
    is_owner: boolean
  } | null
}

function mapRow(row: MembershipRow): Membership | null {
  if (!row.tenants || !row.roles) return null
  return {
    membershipId: row.id,
    tenantId: row.tenant_id,
    tenantName: row.tenants.name,
    tenantSlug: row.tenants.slug,
    roleId: row.role_id,
    roleName: row.roles.name,
    permissions: row.roles.permissions ?? [],
    fieldGates: row.roles.field_gates ?? {},
    landingView: row.landing_view ?? row.roles.landing_view,
    status: row.status,
    isOwner: row.roles.is_owner,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [currentTenantId, setCurrentTenantIdState] = useState<string | null>(
    () => localStorage.getItem(CURRENT_TENANT_KEY),
  )
  const [loading, setLoading] = useState(true)

  const refreshMemberships = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setMemberships([])
      return
    }
    const { data, error } = await supabase
      .from('memberships')
      .select('id, tenant_id, role_id, status, landing_view, tenants(name, slug), roles(name, permissions, field_gates, landing_view, is_owner)')
      .eq('status', 'active')
      .returns<MembershipRow[]>()

    if (error) {
      console.error('failed to load memberships', error)
      setMemberships([])
      return
    }
    setMemberships(data.map(mapRow).filter((m): m is Membership => m !== null))
  }, [])

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session)
      if (data.session) await refreshMemberships()
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next)
      if (next) {
        await refreshMemberships()
      } else {
        setMemberships([])
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [refreshMemberships])

  const setCurrentTenantId = useCallback((tenantId: string) => {
    localStorage.setItem(CURRENT_TENANT_KEY, tenantId)
    setCurrentTenantIdState(tenantId)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    localStorage.removeItem(CURRENT_TENANT_KEY)
    setCurrentTenantIdState(null)
  }, [])

  const currentMembership =
    memberships.find((m) => m.tenantId === currentTenantId) ?? memberships[0] ?? null

  return (
    <AuthContext.Provider
      value={{ session, memberships, currentMembership, loading, setCurrentTenantId, refreshMemberships, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
