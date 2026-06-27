/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} FreehandInputs */

const en_freehand = /** @type {(inputs: FreehandInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Freehand`)
}

const zh_freehand = /** @type {(inputs: FreehandInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`手绘`)
}

/**
 * | output |
 * | --- |
 * | "Freehand" |
 *
 * @param {FreehandInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const freehand =
  /** @type {((inputs?: FreehandInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<FreehandInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_freehand(inputs)
      return zh_freehand(inputs)
    }
  )
