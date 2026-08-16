import { describe, it, expect } from 'vitest'
import { getRoleLevel, getAgentRequiredLevel, getAllowedAgentRoles } from './permissions'

describe('agent permission helpers', () => {
  describe('getRoleLevel', () => {
    it('maps each role to its level', () => {
      expect(getRoleLevel('reviewer')).toBe(1)
      expect(getRoleLevel('editor')).toBe(2)
      expect(getRoleLevel('owner')).toBe(3)
    })

    it('resolves missing roles to 0 (fail closed)', () => {
      expect(getRoleLevel(null)).toBe(0)
      expect(getRoleLevel(undefined)).toBe(0)
    })
  })

  describe('getAgentRequiredLevel', () => {
    it('maps each permission to its required level', () => {
      expect(getAgentRequiredLevel('reviewer')).toBe(1)
      expect(getAgentRequiredLevel('editor')).toBe(2)
      expect(getAgentRequiredLevel('owner')).toBe(3)
    })

    it('defaults missing permissions to reviewer level (1)', () => {
      expect(getAgentRequiredLevel(null)).toBe(1)
      expect(getAgentRequiredLevel(undefined)).toBe(1)
    })
  })

  describe('getAllowedAgentRoles', () => {
    it('returns inclusive role sets per hierarchy', () => {
      expect(getAllowedAgentRoles('owner')).toEqual(['reviewer', 'editor', 'owner'])
      expect(getAllowedAgentRoles('editor')).toEqual(['reviewer', 'editor'])
      expect(getAllowedAgentRoles('reviewer')).toEqual(['reviewer'])
    })

    it('defaults missing roles to reviewer only', () => {
      expect(getAllowedAgentRoles(null)).toEqual(['reviewer'])
      expect(getAllowedAgentRoles(undefined)).toEqual(['reviewer'])
    })
  })
})
