/**
 * | output |
 * | --- |
 * | "AI Autofill" |
 *
 * @param {Ai_AutofillInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const ai_autofill: ((
  inputs?: Ai_AutofillInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Ai_AutofillInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Ai_AutofillInputs = {}
