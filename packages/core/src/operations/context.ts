import type { Via } from '@shumai/operations'

/** Who is invoking an Operation and through which surface. */
export interface OperationContext {
  /** The acting user. Permission checks and audit attribution use this user. */
  userId: string
  /** Where the invocation came from; recorded in audit logs. */
  via: Via
  /** The agent acting on the user's behalf, when invoked by Shumai's built-in agent. */
  agentId?: string
  /**
   * Session hints from the caller (e.g. the agent's current team/project). Never used for
   * authorization or audit attribution, which are always resolved from the affected resource.
   */
  teamId?: string
  projectId?: string
}
