/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} DarkInputs */

const en_dark = /** @type {(inputs: DarkInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Dark`)
}

const zh_dark = /** @type {(inputs: DarkInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`深色`)
}

/**
 * | output |
 * | --- |
 * | "Dark" |
 *
 * @param {DarkInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const dark =
  /** @type {((inputs?: DarkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<DarkInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_dark(inputs)
      return zh_dark(inputs)
    }
  )
