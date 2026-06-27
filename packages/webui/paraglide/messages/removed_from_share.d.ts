/**
 * | output |
 * | --- |
 * | "Removed from share" |
 *
 * @param {Removed_From_ShareInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const removed_from_share: ((
  inputs?: Removed_From_ShareInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Removed_From_ShareInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Removed_From_ShareInputs = {}
