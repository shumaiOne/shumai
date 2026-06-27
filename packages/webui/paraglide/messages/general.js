/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} GeneralInputs */

const en_general = /** @type {(inputs: GeneralInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`General`)
}

const zh_general = /** @type {(inputs: GeneralInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`通用`)
}

/**
 * | output |
 * | --- |
 * | "General" |
 *
 * @param {GeneralInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const general =
  /** @type {((inputs?: GeneralInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<GeneralInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_general(inputs)
      return zh_general(inputs)
    }
  )
