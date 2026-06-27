/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} General_SettingsInputs */

const en_general_settings =
  /** @type {(inputs: General_SettingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`General Settings`)
  }

const zh_general_settings =
  /** @type {(inputs: General_SettingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`通用设置`)
  }

/**
 * | output |
 * | --- |
 * | "General Settings" |
 *
 * @param {General_SettingsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const general_settings =
  /** @type {((inputs?: General_SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<General_SettingsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_general_settings(inputs)
      return zh_general_settings(inputs)
    }
  )
