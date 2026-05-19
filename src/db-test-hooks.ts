import { afterEach, beforeEach } from 'vitest'
import { getPrismaTestingHelper } from '@/db'

export function setupTestDbHooks() {
  beforeEach(async () => {
    await getPrismaTestingHelper().startNewTransaction()
  })

  afterEach(() => {
    getPrismaTestingHelper().rollbackCurrentTransaction()
  })
}
