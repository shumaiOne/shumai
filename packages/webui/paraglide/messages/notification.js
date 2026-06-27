/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} NotificationInputs */

const en_notification = /** @type {(inputs: NotificationInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Notification`)
}

const zh_notification = /** @type {(inputs: NotificationInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`通知`)
}

/**
 * | output |
 * | --- |
 * | "Notification" |
 *
 * @param {NotificationInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const notification =
  /** @type {((inputs?: NotificationInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<NotificationInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_notification(inputs)
      return zh_notification(inputs)
    }
  )
