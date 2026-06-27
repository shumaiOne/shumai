/**
 * | output |
 * | --- |
 * | "Are you sure you want to delete this {type}? This action cannot be undone." |
 *
 * @param {Delete_Confirm_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const delete_confirm_description: ((
  inputs: Delete_Confirm_DescriptionInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Delete_Confirm_DescriptionInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Delete_Confirm_DescriptionInputs = {
  type: NonNullable<unknown>
}
