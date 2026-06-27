/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} BackInputs */

const en_back = /** @type {(inputs: BackInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Back`)
}

const zh_back = /** @type {(inputs: BackInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`返回`)
}

/**
 * | output |
 * | --- |
 * | "Back" |
 *
 * @param {BackInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const back =
  /** @type {((inputs?: BackInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<BackInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_back(inputs)
      return zh_back(inputs)
    }
  )
