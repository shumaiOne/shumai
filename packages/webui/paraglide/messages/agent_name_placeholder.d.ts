/**
 * | output |
 * | --- |
 * | "e.g., Support Assistant" |
 *
 * @param {Agent_Name_PlaceholderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const agent_name_placeholder: ((
  inputs?: Agent_Name_PlaceholderInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Agent_Name_PlaceholderInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Agent_Name_PlaceholderInputs = {}
