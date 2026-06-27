/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Load_SettingsInputs */

const en_failed_load_settings =
  /** @type {(inputs: Failed_Load_SettingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Failed to load settings.`)
  }

const zh_failed_load_settings =
  /** @type {(inputs: Failed_Load_SettingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`加载设置失败。`)
  }

/**
 * | output |
 * | --- |
 * | "Failed to load settings." |
 *
 * @param {Failed_Load_SettingsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_load_settings =
  /** @type {((inputs?: Failed_Load_SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Load_SettingsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_failed_load_settings(inputs)
      return zh_failed_load_settings(inputs)
    }
  )
