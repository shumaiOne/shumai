/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ResetInputs */

const en_reset = /** @type {(inputs: ResetInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Reset`)
}

const zh_reset = /** @type {(inputs: ResetInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`重置`)
}

/**
 * | output |
 * | --- |
 * | "Reset" |
 *
 * @param {ResetInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const reset =
  /** @type {((inputs?: ResetInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ResetInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_reset(inputs)
      return zh_reset(inputs)
    }
  )
