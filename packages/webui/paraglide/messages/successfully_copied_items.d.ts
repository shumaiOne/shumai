/**
 * | output |
 * | --- |
 * | "Successfully copied {count} item(s)" |
 *
 * @param {Successfully_Copied_ItemsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const successfully_copied_items: ((
  inputs: Successfully_Copied_ItemsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Successfully_Copied_ItemsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Successfully_Copied_ItemsInputs = {
  count: NonNullable<unknown>
}
