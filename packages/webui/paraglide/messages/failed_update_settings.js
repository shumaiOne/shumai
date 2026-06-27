/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Update_SettingsInputs */

const en_failed_update_settings =
  /** @type {(inputs: Failed_Update_SettingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Failed to update settings`)
  }

const zh_failed_update_settings =
  /** @type {(inputs: Failed_Update_SettingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`更新设置失败`)
  }

/**
 * | output |
 * | --- |
 * | "Failed to update settings" |
 *
 * @param {Failed_Update_SettingsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_update_settings =
  /** @type {((inputs?: Failed_Update_SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Update_SettingsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_failed_update_settings(inputs)
      return zh_failed_update_settings(inputs)
    }
  )
