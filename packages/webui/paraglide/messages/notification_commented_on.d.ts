/**
 * | output |
 * | --- |
 * | "{creator} commented on {asset}" |
 *
 * @param {Notification_Commented_OnInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const notification_commented_on: ((
  inputs: Notification_Commented_OnInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Notification_Commented_OnInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Notification_Commented_OnInputs = {
  creator: NonNullable<unknown>
  asset: NonNullable<unknown>
}
