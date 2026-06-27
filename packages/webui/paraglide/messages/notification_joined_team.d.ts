/**
 * | output |
 * | --- |
 * | "{user} joined {team}" |
 *
 * @param {Notification_Joined_TeamInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const notification_joined_team: ((
  inputs: Notification_Joined_TeamInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Notification_Joined_TeamInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Notification_Joined_TeamInputs = {
  user: NonNullable<unknown>
  team: NonNullable<unknown>
}
