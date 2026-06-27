/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Login_HereInputs */

const en_login_here = /** @type {(inputs: Login_HereInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Login here`)
}

const zh_login_here = /** @type {(inputs: Login_HereInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`在此登录`)
}

/**
 * | output |
 * | --- |
 * | "Login here" |
 *
 * @param {Login_HereInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const login_here =
  /** @type {((inputs?: Login_HereInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Login_HereInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_login_here(inputs)
      return zh_login_here(inputs)
    }
  )
