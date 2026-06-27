/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Incorrect_PasswordInputs */

const en_incorrect_password =
  /** @type {(inputs: Incorrect_PasswordInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Incorrect password. Please try again.`)
  }

const zh_incorrect_password =
  /** @type {(inputs: Incorrect_PasswordInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`密码错误，请重试。`)
  }

/**
 * | output |
 * | --- |
 * | "Incorrect password. Please try again." |
 *
 * @param {Incorrect_PasswordInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const incorrect_password =
  /** @type {((inputs?: Incorrect_PasswordInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Incorrect_PasswordInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_incorrect_password(inputs)
      return zh_incorrect_password(inputs)
    }
  )
