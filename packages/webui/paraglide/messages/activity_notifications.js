/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Activity_NotificationsInputs */

const en_activity_notifications =
  /** @type {(inputs: Activity_NotificationsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Activity Notifications`)
  }

const zh_activity_notifications =
  /** @type {(inputs: Activity_NotificationsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`活动通知`)
  }

/**
 * | output |
 * | --- |
 * | "Activity Notifications" |
 *
 * @param {Activity_NotificationsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const activity_notifications =
  /** @type {((inputs?: Activity_NotificationsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Activity_NotificationsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_activity_notifications(inputs)
      return zh_activity_notifications(inputs)
    }
  )
