/**
 * | output |
 * | --- |
 * | "{inviterName} invited you to join {targetName} as {role}." |
 *
 * @param {Invite_Join_MessageInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const invite_join_message: ((
  inputs: Invite_Join_MessageInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Invite_Join_MessageInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Invite_Join_MessageInputs = {
  inviterName: NonNullable<unknown>
  targetName: NonNullable<unknown>
  role: NonNullable<unknown>
}
