/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_ProviderInputs */

const en_select_provider = /** @type {(inputs: Select_ProviderInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Select Provider`)
}

const zh_select_provider = /** @type {(inputs: Select_ProviderInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`选择提供商`)
}

/**
 * | output |
 * | --- |
 * | "Select Provider" |
 *
 * @param {Select_ProviderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_provider =
  /** @type {((inputs?: Select_ProviderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_ProviderInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_select_provider(inputs)
      return zh_select_provider(inputs)
    }
  )
