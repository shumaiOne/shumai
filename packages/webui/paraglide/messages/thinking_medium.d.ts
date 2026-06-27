/**
 * | output |
 * | --- |
 * | "Medium" |
 *
 * @param {Thinking_MediumInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const thinking_medium: ((
  inputs?: Thinking_MediumInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Thinking_MediumInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Thinking_MediumInputs = {}
