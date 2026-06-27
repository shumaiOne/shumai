/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Log_OutInputs */

const en_log_out = /** @type {(inputs: Log_OutInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Log out`)
}

const zh_log_out = /** @type {(inputs: Log_OutInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`退出登录`)
}

/**
 * | output |
 * | --- |
 * | "Log out" |
 *
 * @param {Log_OutInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const log_out =
  /** @type {((inputs?: Log_OutInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Log_OutInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_log_out(inputs)
      return zh_log_out(inputs)
    }
  )
