/**
 * | output |
 * | --- |
 * | "This action cannot be undone. This will permanently delete the agent \"{name}\" and remove all its data from our servers." |
 *
 * @param {Delete_Agent_ConfirmationInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const delete_agent_confirmation: ((
  inputs: Delete_Agent_ConfirmationInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Delete_Agent_ConfirmationInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Delete_Agent_ConfirmationInputs = {
  name: NonNullable<unknown>
}
