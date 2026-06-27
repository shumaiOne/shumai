/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ByInputs */

const en_by = /** @type {(inputs: ByInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`by`)
}

const zh_by = /** @type {(inputs: ByInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`由`)
}

/**
 * | output |
 * | --- |
 * | "by" |
 *
 * @param {ByInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const by =
  /** @type {((inputs?: ByInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ByInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_by(inputs)
      return zh_by(inputs)
    }
  )
