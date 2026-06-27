/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Default_ValueInputs */

const en_default_value = /** @type {(inputs: Default_ValueInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Default Value`)
}

const zh_default_value = /** @type {(inputs: Default_ValueInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`默认值`)
}

/**
 * | output |
 * | --- |
 * | "Default Value" |
 *
 * @param {Default_ValueInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const default_value =
  /** @type {((inputs?: Default_ValueInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Default_ValueInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_default_value(inputs)
      return zh_default_value(inputs)
    }
  )
