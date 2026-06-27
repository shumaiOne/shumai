/**
 * | output |
 * | --- |
 * | "Quick reasoning" |
 *
 * @param {Quick_ReasoningInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const quick_reasoning: ((
  inputs?: Quick_ReasoningInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Quick_ReasoningInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Quick_ReasoningInputs = {}
