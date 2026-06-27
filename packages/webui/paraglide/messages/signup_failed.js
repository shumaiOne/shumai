/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_FailedInputs */

const en_signup_failed = /** @type {(inputs: Signup_FailedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Signup failed`)
}

const zh_signup_failed = /** @type {(inputs: Signup_FailedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`注册失败`)
}

/**
 * | output |
 * | --- |
 * | "Signup failed" |
 *
 * @param {Signup_FailedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const signup_failed =
  /** @type {((inputs?: Signup_FailedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_FailedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_signup_failed(inputs)
      return zh_signup_failed(inputs)
    }
  )
