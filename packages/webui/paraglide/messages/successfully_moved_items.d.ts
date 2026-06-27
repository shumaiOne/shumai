/**
 * | output |
 * | --- |
 * | "Successfully moved {count} item(s)" |
 *
 * @param {Successfully_Moved_ItemsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const successfully_moved_items: ((
  inputs: Successfully_Moved_ItemsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Successfully_Moved_ItemsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Successfully_Moved_ItemsInputs = {
  count: NonNullable<unknown>
}
