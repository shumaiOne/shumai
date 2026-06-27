/**
 * | output |
 * | --- |
 * | "Agent deleted successfully" |
 *
 * @param {Agent_Deleted_SuccessfullyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const agent_deleted_successfully: ((
  inputs?: Agent_Deleted_SuccessfullyInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Agent_Deleted_SuccessfullyInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Agent_Deleted_SuccessfullyInputs = {}
