/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Date_TomorrowInputs */

const en_date_tomorrow = /** @type {(inputs: Date_TomorrowInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Tomorrow`)
}

const zh_date_tomorrow = /** @type {(inputs: Date_TomorrowInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`明天`)
}

/**
 * | output |
 * | --- |
 * | "Tomorrow" |
 *
 * @param {Date_TomorrowInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const date_tomorrow =
  /** @type {((inputs?: Date_TomorrowInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Date_TomorrowInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_date_tomorrow(inputs)
      return zh_date_tomorrow(inputs)
    }
  )
