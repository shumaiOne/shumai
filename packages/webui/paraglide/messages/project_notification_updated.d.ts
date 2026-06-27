/**
 * | output |
 * | --- |
 * | "Project notification settings updated" |
 *
 * @param {Project_Notification_UpdatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const project_notification_updated: ((
  inputs?: Project_Notification_UpdatedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Project_Notification_UpdatedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Project_Notification_UpdatedInputs = {}
