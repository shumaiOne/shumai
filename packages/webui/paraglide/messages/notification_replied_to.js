/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ creator: NonNullable<unknown>, asset: NonNullable<unknown> }} Notification_Replied_ToInputs */

const en_notification_replied_to =
  /** @type {(inputs: Notification_Replied_ToInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (`${i?.creator} replied to a comment on ${i?.asset}`)
  }

const zh_notification_replied_to =
  /** @type {(inputs: Notification_Replied_ToInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (`${i?.creator} 回复了 ${i?.asset} 上的评论`)
  }

/**
 * | output |
 * | --- |
 * | "{creator} replied to a comment on {asset}" |
 *
 * @param {Notification_Replied_ToInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const notification_replied_to =
  /** @type {((inputs: Notification_Replied_ToInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notification_Replied_ToInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_notification_replied_to(inputs)
      return zh_notification_replied_to(inputs)
    }
  )
