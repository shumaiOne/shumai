/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Api_KeyInputs */

const en_api_key = /** @type {(inputs: Api_KeyInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`API Key`)
}

const zh_api_key = /** @type {(inputs: Api_KeyInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`API 密钥`)
}

/**
 * | output |
 * | --- |
 * | "API Key" |
 *
 * @param {Api_KeyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const api_key =
  /** @type {((inputs?: Api_KeyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Api_KeyInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_api_key(inputs)
      return zh_api_key(inputs)
    }
  )
