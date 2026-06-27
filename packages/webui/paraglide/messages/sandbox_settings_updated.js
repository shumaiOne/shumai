/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sandbox_Settings_UpdatedInputs */

const en_sandbox_settings_updated =
  /** @type {(inputs: Sandbox_Settings_UpdatedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Sandbox settings updated`)
  }

const zh_sandbox_settings_updated =
  /** @type {(inputs: Sandbox_Settings_UpdatedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`沙箱设置已更新`)
  }

/**
 * | output |
 * | --- |
 * | "Sandbox settings updated" |
 *
 * @param {Sandbox_Settings_UpdatedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const sandbox_settings_updated =
  /** @type {((inputs?: Sandbox_Settings_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sandbox_Settings_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_sandbox_settings_updated(inputs)
      return zh_sandbox_settings_updated(inputs)
    }
  )
