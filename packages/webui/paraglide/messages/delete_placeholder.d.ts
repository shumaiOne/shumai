/**
 * | output |
 * | --- |
 * | "delete" |
 *
 * @param {Delete_PlaceholderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const delete_placeholder: ((
  inputs?: Delete_PlaceholderInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Delete_PlaceholderInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Delete_PlaceholderInputs = {}
