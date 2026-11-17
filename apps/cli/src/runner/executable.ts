import { constants } from 'node:fs'
import { access, realpath } from 'node:fs/promises'
import path from 'node:path'

export async function findExecutable(name: string): Promise<string> {
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!directory) continue
    const candidate = path.resolve(directory, name)
    try {
      await access(candidate, constants.X_OK)
      return await realpath(candidate)
    } catch {
      // Try the next PATH entry.
    }
  }
  throw new Error(`${name} is required on the runner machine and must be available on PATH.`)
}
