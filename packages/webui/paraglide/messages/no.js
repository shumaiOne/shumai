/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} NoInputs */

const en_no = /** @type {(inputs: NoInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`No`)
}

const zh_no = /** @type {(inputs: NoInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`否`)
}

/**
 * | output |
 * | --- |
 * | "No" |
 *
 * @param {NoInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no =
  /** @type {((inputs?: NoInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<NoInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_no(inputs)
      return zh_no(inputs)
    }
  )
