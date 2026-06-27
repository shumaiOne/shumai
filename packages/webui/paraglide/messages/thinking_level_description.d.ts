/**
 * | output |
 * | --- |
 * | "Control the depth of reasoning for complex tasks." |
 *
 * @param {Thinking_Level_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const thinking_level_description: ((
  inputs?: Thinking_Level_DescriptionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Thinking_Level_DescriptionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Thinking_Level_DescriptionInputs = {}
