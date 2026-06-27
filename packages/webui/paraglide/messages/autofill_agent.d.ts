/**
 * | output |
 * | --- |
 * | "Autofill Agent" |
 *
 * @param {Autofill_AgentInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const autofill_agent: ((
  inputs?: Autofill_AgentInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Autofill_AgentInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Autofill_AgentInputs = {}
