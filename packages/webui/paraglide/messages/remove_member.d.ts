/**
 * | output |
 * | --- |
 * | "Remove Member" |
 *
 * @param {Remove_MemberInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const remove_member: ((
  inputs?: Remove_MemberInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Remove_MemberInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Remove_MemberInputs = {}
