/**
 * | output |
 * | --- |
 * | "Create one now" |
 *
 * @param {Create_One_NowInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const create_one_now: ((
  inputs?: Create_One_NowInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Create_One_NowInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Create_One_NowInputs = {}
