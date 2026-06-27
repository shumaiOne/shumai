/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} AscendingInputs */

const en_ascending = /** @type {(inputs: AscendingInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Ascending`)
}

const zh_ascending = /** @type {(inputs: AscendingInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`升序`)
}

/**
 * | output |
 * | --- |
 * | "Ascending" |
 *
 * @param {AscendingInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const ascending =
  /** @type {((inputs?: AscendingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<AscendingInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_ascending(inputs)
      return zh_ascending(inputs)
    }
  )
