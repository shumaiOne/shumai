import { afterEach, beforeEach } from 'vitest'
import { getPrismaTestingHelper } from './index'

export function setupTestDbHooks() {
  beforeEach(async () => {
    await getPrismaTestingHelper().startNewTransaction()
  })

  afterEach(() => {
    getPrismaTestingHelper().rollbackCurrentTransaction()
  })
}
