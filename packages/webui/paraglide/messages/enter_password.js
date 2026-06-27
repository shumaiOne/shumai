/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Enter_PasswordInputs */

const en_enter_password = /** @type {(inputs: Enter_PasswordInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Enter password`)
}

const zh_enter_password = /** @type {(inputs: Enter_PasswordInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`请输入密码`)
}

/**
 * | output |
 * | --- |
 * | "Enter password" |
 *
 * @param {Enter_PasswordInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const enter_password =
  /** @type {((inputs?: Enter_PasswordInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Enter_PasswordInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_enter_password(inputs)
      return zh_enter_password(inputs)
    }
  )
