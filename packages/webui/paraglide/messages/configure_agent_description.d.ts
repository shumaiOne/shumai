/**
 * | output |
 * | --- |
 * | "Configure your AI agent's personality and capabilities." |
 *
 * @param {Configure_Agent_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const configure_agent_description: ((
  inputs?: Configure_Agent_DescriptionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Configure_Agent_DescriptionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Configure_Agent_DescriptionInputs = {}
