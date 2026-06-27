/**
 * | output |
 * | --- |
 * | "Updated" |
 *
 * @param {Updated_AgoInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const updated_ago: ((
  inputs?: Updated_AgoInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Updated_AgoInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Updated_AgoInputs = {}
