/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Date_CreatedInputs */

const en_date_created = /** @type {(inputs: Date_CreatedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Date Created`)
}

const zh_date_created = /** @type {(inputs: Date_CreatedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`创建日期`)
}

/**
 * | output |
 * | --- |
 * | "Date Created" |
 *
 * @param {Date_CreatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const date_created =
  /** @type {((inputs?: Date_CreatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Date_CreatedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_date_created(inputs)
      return zh_date_created(inputs)
    }
  )
