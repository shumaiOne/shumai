/**
 * | output |
 * | --- |
 * | "Agent Soul (Personality)" |
 *
 * @param {Agent_SoulInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const agent_soul: ((
  inputs?: Agent_SoulInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Agent_SoulInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Agent_SoulInputs = {}
