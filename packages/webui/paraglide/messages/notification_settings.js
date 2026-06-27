/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Notification_SettingsInputs */

const en_notification_settings =
  /** @type {(inputs: Notification_SettingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Notification Settings`)
  }

const zh_notification_settings =
  /** @type {(inputs: Notification_SettingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`通知设置`)
  }

/**
 * | output |
 * | --- |
 * | "Notification Settings" |
 *
 * @param {Notification_SettingsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const notification_settings =
  /** @type {((inputs?: Notification_SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notification_SettingsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_notification_settings(inputs)
      return zh_notification_settings(inputs)
    }
  )
