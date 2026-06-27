/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} LineInputs */

const en_line = /** @type {(inputs: LineInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Line`)
}

const zh_line = /** @type {(inputs: LineInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`线条`)
}

/**
 * | output |
 * | --- |
 * | "Line" |
 *
 * @param {LineInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const line =
  /** @type {((inputs?: LineInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<LineInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_line(inputs)
      return zh_line(inputs)
    }
  )
