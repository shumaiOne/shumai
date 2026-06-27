/**
 * | output |
 * | --- |
 * | "{count} Item(s) selected" |
 *
 * @param {N_Items_SelectedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const n_items_selected: ((
  inputs: N_Items_SelectedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    N_Items_SelectedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type N_Items_SelectedInputs = {
  count: NonNullable<unknown>
}
