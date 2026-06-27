/**
 * | output |
 * | --- |
 * | "Failed to add {name}" |
 *
 * @param {Failed_To_Add_MemberInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_add_member: ((
  inputs: Failed_To_Add_MemberInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Failed_To_Add_MemberInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Failed_To_Add_MemberInputs = {
  name: NonNullable<unknown>
}
