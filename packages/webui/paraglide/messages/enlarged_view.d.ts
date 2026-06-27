/**
 * | output |
 * | --- |
 * | "Enlarged view" |
 *
 * @param {Enlarged_ViewInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const enlarged_view: ((
  inputs?: Enlarged_ViewInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Enlarged_ViewInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Enlarged_ViewInputs = {}
