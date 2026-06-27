/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Api_Tokens_FoundInputs */

const en_no_api_tokens_found =
  /** @type {(inputs: No_Api_Tokens_FoundInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `No API tokens found. Generate one above to get started.`
    )
  }

const zh_no_api_tokens_found =
  /** @type {(inputs: No_Api_Tokens_FoundInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`未找到 API 令牌。请在上方生成一个以开始使用。`)
  }

/**
 * | output |
 * | --- |
 * | "No API tokens found. Generate one above to get started." |
 *
 * @param {No_Api_Tokens_FoundInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_api_tokens_found =
  /** @type {((inputs?: No_Api_Tokens_FoundInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Api_Tokens_FoundInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_no_api_tokens_found(inputs)
      return zh_no_api_tokens_found(inputs)
    }
  )
