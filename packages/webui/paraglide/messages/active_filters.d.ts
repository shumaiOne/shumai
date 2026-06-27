/**
 * | output |
 * | --- |
 * | "active" |
 *
 * @param {Active_FiltersInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const active_filters: ((
  inputs?: Active_FiltersInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Active_FiltersInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Active_FiltersInputs = {}
