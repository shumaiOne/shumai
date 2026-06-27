/**
 * | output |
 * | --- |
 * | "Open navigation menu" |
 *
 * @param {Open_Navigation_MenuInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const open_navigation_menu: ((
  inputs?: Open_Navigation_MenuInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Open_Navigation_MenuInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Open_Navigation_MenuInputs = {}
