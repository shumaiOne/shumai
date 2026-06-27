/**
 * | output |
 * | --- |
 * | "Matched {count} items" |
 *
 * @param {Matched_ItemsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const matched_items: ((
  inputs: Matched_ItemsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Matched_ItemsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Matched_ItemsInputs = {
  count: NonNullable<unknown>
}
