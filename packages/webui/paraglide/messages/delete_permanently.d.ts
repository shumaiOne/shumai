/**
 * | output |
 * | --- |
 * | "Delete Permanently" |
 *
 * @param {Delete_PermanentlyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const delete_permanently: ((
  inputs?: Delete_PermanentlyInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Delete_PermanentlyInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Delete_PermanentlyInputs = {}
