/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_NotificationsInputs */

const en_no_notifications =
  /** @type {(inputs: No_NotificationsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`No notifications`)
  }

const zh_no_notifications =
  /** @type {(inputs: No_NotificationsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`暂无通知`)
  }

/**
 * | output |
 * | --- |
 * | "No notifications" |
 *
 * @param {No_NotificationsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_notifications =
  /** @type {((inputs?: No_NotificationsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_NotificationsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_no_notifications(inputs)
      return zh_no_notifications(inputs)
    }
  )
