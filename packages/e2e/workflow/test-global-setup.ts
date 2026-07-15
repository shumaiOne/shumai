import { setup as dbSetup, teardown as dbTeardown } from '../../db/src/test-global-setup'
import { GenericContainer, StartedTestContainer } from 'testcontainers'

let temporalContainer: StartedTestContainer | null = null

export async function setup() {
  // 1. Start Postgres DB container & run migrations
  await dbSetup()

  // 2. Start Temporal Dev Server container if running in temporal mode
  if (process.env.WORKFLOW_EXECUTOR === 'temporal') {
    console.log('Starting Temporal Dev Server container using testcontainers...')
    try {
      temporalContainer = await new GenericContainer('temporalio/temporal:latest')
        .withExposedPorts(7233, 8233)
        .withCommand(['server', 'start-dev', '--ip', '0.0.0.0'])
        .start()

      const host = temporalContainer.getHost()
      const mappedPort = temporalContainer.getMappedPort(7233)
      const address = `${host}:${mappedPort}`

      process.env.TEMPORAL_ADDRESS = address
      console.log(`Temporal Dev Server container started. Address: ${address}`)

      // Brief sleep to ensure temporal dev server is fully ready to accept gRPC clients
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (err) {
      console.error('Failed to start Temporal Dev Server container:', err)
      throw err
    }
  }
}

export async function teardown() {
  // 1. Stop Temporal container if running
  if (temporalContainer) {
    console.log('Stopping Temporal Dev Server container...')
    try {
      await temporalContainer.stop()
    } catch (err) {
      console.error('Failed to stop Temporal Dev Server container:', err)
    }
    temporalContainer = null
  }

  // 2. Stop Postgres DB container
  await dbTeardown()
}
