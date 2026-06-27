/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Provider_Name_Must_Be_UniqueInputs */

const en_provider_name_must_be_unique =
  /** @type {(inputs: Provider_Name_Must_Be_UniqueInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Provider name must be unique`)
  }

const zh_provider_name_must_be_unique =
  /** @type {(inputs: Provider_Name_Must_Be_UniqueInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`提供商名称必须唯一`)
  }

/**
 * | output |
 * | --- |
 * | "Provider name must be unique" |
 *
 * @param {Provider_Name_Must_Be_UniqueInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const provider_name_must_be_unique =
  /** @type {((inputs?: Provider_Name_Must_Be_UniqueInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Provider_Name_Must_Be_UniqueInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_provider_name_must_be_unique(inputs)
      return zh_provider_name_must_be_unique(inputs)
    }
  )
