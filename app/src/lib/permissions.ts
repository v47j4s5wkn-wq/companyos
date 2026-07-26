/** Mirrors the server's has_permission() check (identity_rls migration) so the
 * UI and the API never disagree about what someone may do — brief §3.2. This is
 * advisory only: every mutation is re-checked by RLS/RPC server-side regardless. */
export function hasPermission(membership: { isOwner: boolean; permissions: string[] } | null, perm: string): boolean {
  if (!membership) return false
  if (membership.isOwner) return true
  return membership.permissions.includes(perm)
}
