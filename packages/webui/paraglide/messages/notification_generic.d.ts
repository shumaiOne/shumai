/**
 * | output |
 * | --- |
 * | "New notification from {creator}" |
 *
 * @param {Notification_GenericInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const notification_generic: ((
  inputs: Notification_GenericInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Notification_GenericInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Notification_GenericInputs = {
  creator: NonNullable<unknown>
}
