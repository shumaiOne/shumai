/**
 * | output |
 * | --- |
 * | "Are you sure you want to remove {name} from this {type}? This action cannot be undone." |
 *
 * @param {Remove_Member_ConfirmationInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const remove_member_confirmation: ((
  inputs: Remove_Member_ConfirmationInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Remove_Member_ConfirmationInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Remove_Member_ConfirmationInputs = {
  name: NonNullable<unknown>
  type: NonNullable<unknown>
}
