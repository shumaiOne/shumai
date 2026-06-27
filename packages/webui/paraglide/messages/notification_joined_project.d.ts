/**
 * | output |
 * | --- |
 * | "{user} joined {project}" |
 *
 * @param {Notification_Joined_ProjectInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const notification_joined_project: ((
  inputs: Notification_Joined_ProjectInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Notification_Joined_ProjectInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Notification_Joined_ProjectInputs = {
  user: NonNullable<unknown>
  project: NonNullable<unknown>
}
