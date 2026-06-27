/**
 * | output |
 * | --- |
 * | "Chat Agents" |
 *
 * @param {Chat_AgentsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const chat_agents: ((
  inputs?: Chat_AgentsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Chat_AgentsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Chat_AgentsInputs = {}
