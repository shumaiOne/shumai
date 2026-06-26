/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} NotificationsInputs */

const en_notifications = /** @type {(inputs: NotificationsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Notifications`)
}

const zh_notifications = /** @type {(inputs: NotificationsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`通知中心`)
}

/**
 * | output |
 * | --- |
 * | "Notifications" |
 *
 * @param {NotificationsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const notifications =
  /** @type {((inputs?: NotificationsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<NotificationsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_notifications(inputs)
      return zh_notifications(inputs)
    }
  )
