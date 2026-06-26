/**
 * | output |
 * | --- |
 * | "Link Visibility" |
 *
 * @param {Link_VisibilityInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const link_visibility: ((
  inputs?: Link_VisibilityInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Link_VisibilityInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Link_VisibilityInputs = {}
