/**
 * | output |
 * | --- |
 * | "Agent updated successfully" |
 *
 * @param {Agent_Updated_SuccessfullyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const agent_updated_successfully: ((
  inputs?: Agent_Updated_SuccessfullyInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Agent_Updated_SuccessfullyInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Agent_Updated_SuccessfullyInputs = {}
