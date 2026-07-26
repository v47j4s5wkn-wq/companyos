export interface Membership {
  membershipId: string
  tenantId: string
  tenantName: string
  tenantSlug: string
  roleId: string
  roleName: string
  permissions: string[]
  fieldGates: Record<string, boolean>
  landingView: string
  status: 'active' | 'deactivated'
  isOwner: boolean
}
