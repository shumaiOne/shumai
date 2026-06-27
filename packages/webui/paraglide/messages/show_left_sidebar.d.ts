/**
 * | output |
 * | --- |
 * | "Show Left Sidebar" |
 *
 * @param {Show_Left_SidebarInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const show_left_sidebar: ((
  inputs?: Show_Left_SidebarInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Show_Left_SidebarInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Show_Left_SidebarInputs = {}
