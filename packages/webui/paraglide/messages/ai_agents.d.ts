/**
 * | output |
 * | --- |
 * | "AI Agents" |
 *
 * @param {Ai_AgentsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const ai_agents: ((
  inputs?: Ai_AgentsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Ai_AgentsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Ai_AgentsInputs = {}
