/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Built_InInputs */

const en_built_in = /** @type {(inputs: Built_InInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Built-in`)
}

const zh_built_in = /** @type {(inputs: Built_InInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`内置`)
}

/**
 * | output |
 * | --- |
 * | "Built-in" |
 *
 * @param {Built_InInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const built_in =
  /** @type {((inputs?: Built_InInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Built_InInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_built_in(inputs)
      return zh_built_in(inputs)
    }
  )
