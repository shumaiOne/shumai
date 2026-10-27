import { HTTPException } from 'hono/http-exception'

/**
 * Runs a service call whose plain `Error`s describe invalid input (e.g. "file is not in the
 * stack") and reports them as 400 Bad Request instead of a server error. Other errors, such as
 * `HTTPException`s and database errors, pass through unchanged.
 */
export async function asBadRequest<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof Error && err.constructor === Error) {
      throw new HTTPException(400, { message: err.message })
    }
    throw err
  }
}

/** A 400 Bad Request with a message for the caller. */
export function badRequest(message: string): HTTPException {
  return new HTTPException(400, { message })
}
