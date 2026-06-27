/**
 * | output |
 * | --- |
 * | "A → Z" |
 *
 * @param {Sort_A_To_ZInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sort_a_to_z: ((
  inputs?: Sort_A_To_ZInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Sort_A_To_ZInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Sort_A_To_ZInputs = {}
