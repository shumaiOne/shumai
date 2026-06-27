/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_New_ProviderInputs */

const en_add_new_provider =
  /** @type {(inputs: Add_New_ProviderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Add New Provider`)
  }

const zh_add_new_provider =
  /** @type {(inputs: Add_New_ProviderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`添加新提供商`)
  }

/**
 * | output |
 * | --- |
 * | "Add New Provider" |
 *
 * @param {Add_New_ProviderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const add_new_provider =
  /** @type {((inputs?: Add_New_ProviderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_New_ProviderInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_add_new_provider(inputs)
      return zh_add_new_provider(inputs)
    }
  )
