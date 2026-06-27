/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sign_UpInputs */

const en_sign_up = /** @type {(inputs: Sign_UpInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Sign up`)
}

const zh_sign_up = /** @type {(inputs: Sign_UpInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`注册`)
}

/**
 * | output |
 * | --- |
 * | "Sign up" |
 *
 * @param {Sign_UpInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sign_up =
  /** @type {((inputs?: Sign_UpInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sign_UpInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_sign_up(inputs)
      return zh_sign_up(inputs)
    }
  )
