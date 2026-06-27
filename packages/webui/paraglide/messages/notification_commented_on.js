/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ creator: NonNullable<unknown>, asset: NonNullable<unknown> }} Notification_Commented_OnInputs */

const en_notification_commented_on =
  /** @type {(inputs: Notification_Commented_OnInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (`${i?.creator} commented on ${i?.asset}`)
  }

const zh_notification_commented_on =
  /** @type {(inputs: Notification_Commented_OnInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (`${i?.creator} 评论了 ${i?.asset}`)
  }

/**
 * | output |
 * | --- |
 * | "{creator} commented on {asset}" |
 *
 * @param {Notification_Commented_OnInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const notification_commented_on =
  /** @type {((inputs: Notification_Commented_OnInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notification_Commented_OnInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_notification_commented_on(inputs)
      return zh_notification_commented_on(inputs)
    }
  )
