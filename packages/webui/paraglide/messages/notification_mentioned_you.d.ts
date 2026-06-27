/**
 * | output |
 * | --- |
 * | "{creator} mentioned you in {asset}" |
 *
 * @param {Notification_Mentioned_YouInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const notification_mentioned_you: ((
  inputs: Notification_Mentioned_YouInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Notification_Mentioned_YouInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Notification_Mentioned_YouInputs = {
  creator: NonNullable<unknown>
  asset: NonNullable<unknown>
}
