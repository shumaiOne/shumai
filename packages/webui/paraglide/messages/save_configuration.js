/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Save_ConfigurationInputs */

const en_save_configuration =
  /** @type {(inputs: Save_ConfigurationInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Save Configuration`)
  }

const zh_save_configuration =
  /** @type {(inputs: Save_ConfigurationInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`保存配置`)
  }

/**
 * | output |
 * | --- |
 * | "Save Configuration" |
 *
 * @param {Save_ConfigurationInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const save_configuration =
  /** @type {((inputs?: Save_ConfigurationInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Save_ConfigurationInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_save_configuration(inputs)
      return zh_save_configuration(inputs)
    }
  )
