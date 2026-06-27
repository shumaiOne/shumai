/**
 * | output |
 * | --- |
 * | "No item selected" |
 *
 * @param {No_Item_SelectedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_item_selected: ((
  inputs?: No_Item_SelectedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    No_Item_SelectedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type No_Item_SelectedInputs = {}
