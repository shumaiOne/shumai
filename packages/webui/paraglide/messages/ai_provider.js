/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ai_ProviderInputs */

const en_ai_provider = /** @type {(inputs: Ai_ProviderInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`AI Provider`)
}

const zh_ai_provider = /** @type {(inputs: Ai_ProviderInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`AI 提供商`)
}

/**
 * | output |
 * | --- |
 * | "AI Provider" |
 *
 * @param {Ai_ProviderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const ai_provider =
  /** @type {((inputs?: Ai_ProviderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ai_ProviderInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_ai_provider(inputs)
      return zh_ai_provider(inputs)
    }
  )
