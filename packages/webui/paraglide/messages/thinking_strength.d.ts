/**
 * | output |
 * | --- |
 * | "Thinking Strength" |
 *
 * @param {Thinking_StrengthInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const thinking_strength: ((
  inputs?: Thinking_StrengthInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Thinking_StrengthInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Thinking_StrengthInputs = {}
