/**
 * | output |
 * | --- |
 * | "Expiration Date" |
 *
 * @param {Expiration_DateInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const expiration_date: ((
  inputs?: Expiration_DateInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Expiration_DateInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Expiration_DateInputs = {}
