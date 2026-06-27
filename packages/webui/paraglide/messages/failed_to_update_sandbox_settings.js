/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Update_Sandbox_SettingsInputs */

const en_failed_to_update_sandbox_settings =
  /** @type {(inputs: Failed_To_Update_Sandbox_SettingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Failed to update sandbox settings`)
  }

const zh_failed_to_update_sandbox_settings =
  /** @type {(inputs: Failed_To_Update_Sandbox_SettingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`更新沙箱设置失败`)
  }

/**
 * | output |
 * | --- |
 * | "Failed to update sandbox settings" |
 *
 * @param {Failed_To_Update_Sandbox_SettingsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_update_sandbox_settings =
  /** @type {((inputs?: Failed_To_Update_Sandbox_SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Update_Sandbox_SettingsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_failed_to_update_sandbox_settings(inputs)
      return zh_failed_to_update_sandbox_settings(inputs)
    }
  )
