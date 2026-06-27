/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} BoxInputs */

const en_box = /** @type {(inputs: BoxInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Box`)
}

const zh_box = /** @type {(inputs: BoxInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`矩形`)
}

/**
 * | output |
 * | --- |
 * | "Box" |
 *
 * @param {BoxInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const box =
  /** @type {((inputs?: BoxInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<BoxInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_box(inputs)
      return zh_box(inputs)
    }
  )
