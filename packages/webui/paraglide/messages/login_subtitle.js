/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Login_SubtitleInputs */

const en_login_subtitle = /** @type {(inputs: Login_SubtitleInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Enter your credentials to access your account.`)
}

const zh_login_subtitle = /** @type {(inputs: Login_SubtitleInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`输入您的凭证以访问您的账户。`)
}

/**
 * | output |
 * | --- |
 * | "Enter your credentials to access your account." |
 *
 * @param {Login_SubtitleInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const login_subtitle =
  /** @type {((inputs?: Login_SubtitleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Login_SubtitleInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_login_subtitle(inputs)
      return zh_login_subtitle(inputs)
    }
  )
