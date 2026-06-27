/**
 * | output |
 * | --- |
 * | "Today" |
 *
 * @param {Date_TodayInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const date_today: ((
  inputs?: Date_TodayInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Date_TodayInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Date_TodayInputs = {}
