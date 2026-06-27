/**
 * | output |
 * | --- |
 * | "High" |
 *
 * @param {Thinking_HighInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const thinking_high: ((
  inputs?: Thinking_HighInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Thinking_HighInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Thinking_HighInputs = {}
