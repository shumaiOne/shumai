/**
 * | output |
 * | --- |
 * | "Failed to update notification settings" |
 *
 * @param {Failed_To_Update_Notification_SettingsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_update_notification_settings: ((
  inputs?: Failed_To_Update_Notification_SettingsInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Failed_To_Update_Notification_SettingsInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Failed_To_Update_Notification_SettingsInputs = {}
