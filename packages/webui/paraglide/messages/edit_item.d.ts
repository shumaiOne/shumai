/**
 * | output |
 * | --- |
 * | "Edit {name}" |
 *
 * @param {Edit_ItemInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const edit_item: ((
  inputs: Edit_ItemInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Edit_ItemInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Edit_ItemInputs = {
  name: NonNullable<unknown>
}
