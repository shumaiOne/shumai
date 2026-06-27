/**
 * | output |
 * | --- |
 * | "Remove from Share" |
 *
 * @param {Remove_From_ShareInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const remove_from_share: ((
  inputs?: Remove_From_ShareInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Remove_From_ShareInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Remove_From_ShareInputs = {}
