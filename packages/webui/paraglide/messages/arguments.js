/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ArgumentsInputs */

const en_arguments = /** @type {(inputs: ArgumentsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Arguments`)
}

const zh_arguments = /** @type {(inputs: ArgumentsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`参数`)
}

/**
 * | output |
 * | --- |
 * | "Arguments" |
 *
 * @param {ArgumentsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const arguments =
  /** @type {((inputs?: ArgumentsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ArgumentsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_arguments(inputs)
      return zh_arguments(inputs)
    }
  )
