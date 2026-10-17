import { setup as dbSetup, teardown as dbTeardown } from '../../db/src/test-global-setup'

export async function setup() {
  await dbSetup()
}

export async function teardown() {
  await dbTeardown()
}
