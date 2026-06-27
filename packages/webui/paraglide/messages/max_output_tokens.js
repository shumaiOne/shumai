/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Max_Output_TokensInputs */

const en_max_output_tokens =
  /** @type {(inputs: Max_Output_TokensInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Max Output Tokens`)
  }

const zh_max_output_tokens =
  /** @type {(inputs: Max_Output_TokensInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`最大输出令牌数`)
  }

/**
 * | output |
 * | --- |
 * | "Max Output Tokens" |
 *
 * @param {Max_Output_TokensInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const max_output_tokens =
  /** @type {((inputs?: Max_Output_TokensInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Max_Output_TokensInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_max_output_tokens(inputs)
      return zh_max_output_tokens(inputs)
    }
  )
