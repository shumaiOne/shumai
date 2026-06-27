/**
 * | output |
 * | --- |
 * | "Save Changes" |
 *
 * @param {Save_ChangesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const save_changes: ((
  inputs?: Save_ChangesInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Save_ChangesInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Save_ChangesInputs = {}
