/**
 * | output |
 * | --- |
 * | "Empty Trash?" |
 *
 * @param {Empty_Trash_TitleInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const empty_trash_title: ((
  inputs?: Empty_Trash_TitleInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Empty_Trash_TitleInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Empty_Trash_TitleInputs = {}
