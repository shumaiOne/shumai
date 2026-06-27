/**
 * | output |
 * | --- |
 * | "Tomorrow" |
 *
 * @param {Date_TomorrowInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const date_tomorrow: ((
  inputs?: Date_TomorrowInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Date_TomorrowInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Date_TomorrowInputs = {}
