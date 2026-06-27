/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Token_NameInputs */

const en_token_name = /** @type {(inputs: Token_NameInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Token Name`)
}

const zh_token_name = /** @type {(inputs: Token_NameInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`令牌名称`)
}

/**
 * | output |
 * | --- |
 * | "Token Name" |
 *
 * @param {Token_NameInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const token_name =
  /** @type {((inputs?: Token_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Token_NameInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_token_name(inputs)
      return zh_token_name(inputs)
    }
  )
