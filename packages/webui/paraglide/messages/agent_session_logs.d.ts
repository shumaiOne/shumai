/**
 * | output |
 * | --- |
 * | "Agent Session Logs" |
 *
 * @param {Agent_Session_LogsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const agent_session_logs: ((
  inputs?: Agent_Session_LogsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Agent_Session_LogsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Agent_Session_LogsInputs = {}
