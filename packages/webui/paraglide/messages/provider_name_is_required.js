/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Provider_Name_Is_RequiredInputs */

const en_provider_name_is_required =
  /** @type {(inputs: Provider_Name_Is_RequiredInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Provider name is required`)
  }

const zh_provider_name_is_required =
  /** @type {(inputs: Provider_Name_Is_RequiredInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`提供商名称为必填项`)
  }

/**
 * | output |
 * | --- |
 * | "Provider name is required" |
 *
 * @param {Provider_Name_Is_RequiredInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const provider_name_is_required =
  /** @type {((inputs?: Provider_Name_Is_RequiredInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Provider_Name_Is_RequiredInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_provider_name_is_required(inputs)
      return zh_provider_name_is_required(inputs)
    }
  )
