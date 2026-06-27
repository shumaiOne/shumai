/**
 * | output |
 * | --- |
 * | "Updated" |
 *
 * @param {Sort_UpdatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sort_updated: ((
  inputs?: Sort_UpdatedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Sort_UpdatedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Sort_UpdatedInputs = {}
