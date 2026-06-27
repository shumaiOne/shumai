/**
 * | output |
 * | --- |
 * | "Created by Agent" |
 *
 * @param {Created_By_AgentInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const created_by_agent: ((
  inputs?: Created_By_AgentInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Created_By_AgentInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Created_By_AgentInputs = {}
