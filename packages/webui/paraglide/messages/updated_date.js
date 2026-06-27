/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Updated_DateInputs */

const en_updated_date = /** @type {(inputs: Updated_DateInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Updated`)
}

const zh_updated_date = /** @type {(inputs: Updated_DateInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`更新于`)
}

/**
 * | output |
 * | --- |
 * | "Updated" |
 *
 * @param {Updated_DateInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const updated_date =
  /** @type {((inputs?: Updated_DateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Updated_DateInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_updated_date(inputs)
      return zh_updated_date(inputs)
    }
  )
