/**
 * | output |
 * | --- |
 * | "{creator} updated status of {asset}" |
 *
 * @param {Notification_Status_UpdatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const notification_status_updated: ((
  inputs: Notification_Status_UpdatedInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Notification_Status_UpdatedInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Notification_Status_UpdatedInputs = {
  creator: NonNullable<unknown>
  asset: NonNullable<unknown>
}
