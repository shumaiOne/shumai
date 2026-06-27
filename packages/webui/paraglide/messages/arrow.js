/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ArrowInputs */

const en_arrow = /** @type {(inputs: ArrowInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Arrow`)
}

const zh_arrow = /** @type {(inputs: ArrowInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`箭头`)
}

/**
 * | output |
 * | --- |
 * | "Arrow" |
 *
 * @param {ArrowInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const arrow =
  /** @type {((inputs?: ArrowInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ArrowInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_arrow(inputs)
      return zh_arrow(inputs)
    }
  )
