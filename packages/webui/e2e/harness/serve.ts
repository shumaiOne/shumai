import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import index from './index.html'

/**
 * Backend-free harness server for the Playwright e2e suite.
 *
 * Uses Bun's native HTML bundler (the same path the real app uses via
 * `Bun.serve({ routes })` in apps/web) so the test toolchain matches the
 * project's Bun-based dev/prod serving. Tailwind is applied through the
 * `bun-plugin-tailwind` entry configured in the repo's bunfig.toml
 * ([serve.static]). It serves:
 *   - the harness page (index.html -> main.tsx, bundled on the fly), and
 *   - the committed fixture video from ../fixtures at the site root.
 */
const here = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(here, '..', 'fixtures')

const port = process.env.HARNESS_PORT ? Number(process.env.HARNESS_PORT) : 5199

const server = Bun.serve({
  port,
  development: true,
  routes: {
    '/sample.mp4': () =>
      new Response(Bun.file(join(fixturesDir, 'sample.mp4')), {
        headers: { 'Content-Type': 'video/mp4' },
      }),
    '/sample-long-audio.mp4': () =>
      new Response(Bun.file(join(fixturesDir, 'sample-long-audio.mp4')), {
        headers: { 'Content-Type': 'video/mp4' },
      }),
    '/': index,
    '/*': index,
  },
})

console.log(`🎬 Video player harness running at ${server.url}`)
