/**
 * | output |
 * | --- |
 * | "Configure security and network restrictions for the AI agent." |
 *
 * @param {Sandbox_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sandbox_description: ((
  inputs?: Sandbox_DescriptionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Sandbox_DescriptionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Sandbox_DescriptionInputs = {}
