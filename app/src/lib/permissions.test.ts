import { describe, expect, it } from 'vitest'
import { hasPermission } from './permissions'

describe('hasPermission', () => {
  it('denies everything when there is no membership', () => {
    expect(hasPermission(null, 'members.manage')).toBe(false)
  })

  it('grants everything to an owner regardless of the permissions array', () => {
    expect(hasPermission({ isOwner: true, permissions: [] }, 'members.manage')).toBe(true)
    expect(hasPermission({ isOwner: true, permissions: [] }, 'anything.at.all')).toBe(true)
  })

  it('grants only listed permissions to a non-owner', () => {
    const membership = { isOwner: false, permissions: ['workItem.view.assigned'] }
    expect(hasPermission(membership, 'workItem.view.assigned')).toBe(true)
    expect(hasPermission(membership, 'members.manage')).toBe(false)
  })
})
