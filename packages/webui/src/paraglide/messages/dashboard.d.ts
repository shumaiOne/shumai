/**
 * | output |
 * | --- |
 * | "Dashboard" |
 *
 * @param {DashboardInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const dashboard: ((
  inputs?: DashboardInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    DashboardInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type DashboardInputs = {}
