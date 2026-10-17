import { DBOS } from '@dbos-inc/dbos-sdk'
import { getDbosDatabaseUrl } from './dbos-executor'

export async function migrateDbos(url?: string): Promise<void> {
  const dbUrl = getDbosDatabaseUrl(url)
  await DBOS.migrate(dbUrl)
}

if (import.meta.main) {
  await migrateDbos()
}
