/** An expected failure, printed as `Error: <message>` with exit code 1. */
export class CliError extends Error {
  /** When true, the message already carries its own prefix and is printed as-is. */
  readonly prefixed: boolean

  constructor(message: string, options: { prefixed?: boolean } = {}) {
    super(message)
    this.name = 'CliError'
    this.prefixed = options.prefixed ?? false
  }
}

export function formatCliError(err: unknown): string {
  if (err instanceof CliError) {
    return err.prefixed ? err.message : `Error: ${err.message}`
  }
  return `Unexpected error: ${err instanceof Error ? err.message : String(err)}`
}
