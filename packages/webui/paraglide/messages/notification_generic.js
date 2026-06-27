/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ creator: NonNullable<unknown> }} Notification_GenericInputs */

const en_notification_generic =
  /** @type {(inputs: Notification_GenericInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (`New notification from ${i?.creator}`)
  }

const zh_notification_generic =
  /** @type {(inputs: Notification_GenericInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (`来自 ${i?.creator} 的新通知`)
  }

/**
 * | output |
 * | --- |
 * | "New notification from {creator}" |
 *
 * @param {Notification_GenericInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const notification_generic =
  /** @type {((inputs: Notification_GenericInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notification_GenericInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_notification_generic(inputs)
      return zh_notification_generic(inputs)
    }
  )
