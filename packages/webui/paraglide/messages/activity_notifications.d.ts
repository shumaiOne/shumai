/**
 * | output |
 * | --- |
 * | "Activity Notifications" |
 *
 * @param {Activity_NotificationsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const activity_notifications: ((
  inputs?: Activity_NotificationsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Activity_NotificationsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Activity_NotificationsInputs = {}
