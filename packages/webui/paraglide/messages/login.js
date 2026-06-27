/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} LoginInputs */

const en_login = /** @type {(inputs: LoginInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Login`)
}

const zh_login = /** @type {(inputs: LoginInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`登录`)
}

/**
 * | output |
 * | --- |
 * | "Login" |
 *
 * @param {LoginInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const login =
  /** @type {((inputs?: LoginInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<LoginInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_login(inputs)
      return zh_login(inputs)
    }
  )
