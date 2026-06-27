/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ creator: NonNullable<unknown>, asset: NonNullable<unknown> }} Notification_Status_UpdatedInputs */

const en_notification_status_updated =
  /** @type {(inputs: Notification_Status_UpdatedInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (`${i?.creator} updated status of ${i?.asset}`)
  }

const zh_notification_status_updated =
  /** @type {(inputs: Notification_Status_UpdatedInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (`${i?.creator} 更新了 ${i?.asset} 的状态`)
  }

/**
 * | output |
 * | --- |
 * | "{creator} updated status of {asset}" |
 *
 * @param {Notification_Status_UpdatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const notification_status_updated =
  /** @type {((inputs: Notification_Status_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notification_Status_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_notification_status_updated(inputs)
      return zh_notification_status_updated(inputs)
    }
  )
