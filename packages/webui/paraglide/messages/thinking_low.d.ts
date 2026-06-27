/**
 * | output |
 * | --- |
 * | "Low" |
 *
 * @param {Thinking_LowInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const thinking_low: ((
  inputs?: Thinking_LowInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Thinking_LowInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Thinking_LowInputs = {}
