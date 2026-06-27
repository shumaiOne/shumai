/**
 * | output |
 * | --- |
 * | "Exact date..." |
 *
 * @param {Exact_DateInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const exact_date: ((
  inputs?: Exact_DateInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Exact_DateInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Exact_DateInputs = {}
