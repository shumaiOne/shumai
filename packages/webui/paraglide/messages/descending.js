/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} DescendingInputs */

const en_descending = /** @type {(inputs: DescendingInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Descending`)
}

const zh_descending = /** @type {(inputs: DescendingInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`降序`)
}

/**
 * | output |
 * | --- |
 * | "Descending" |
 *
 * @param {DescendingInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const descending =
  /** @type {((inputs?: DescendingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<DescendingInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_descending(inputs)
      return zh_descending(inputs)
    }
  )
