import { formatCliError } from './operations/errors'
import { createProgram } from './program'

createProgram()
  .parseAsync(process.argv)
  .catch((err: unknown) => {
    console.error(formatCliError(err))
    process.exit(1)
  })
