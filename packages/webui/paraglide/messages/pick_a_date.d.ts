/**
 * | output |
 * | --- |
 * | "Pick a date" |
 *
 * @param {Pick_A_DateInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const pick_a_date: ((
  inputs?: Pick_A_DateInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Pick_A_DateInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Pick_A_DateInputs = {}
