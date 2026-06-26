/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} SettingsInputs */

const en_settings = /** @type {(inputs: SettingsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Settings`)
}

const zh_settings = /** @type {(inputs: SettingsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`设置`)
}

/**
 * | output |
 * | --- |
 * | "Settings" |
 *
 * @param {SettingsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const settings =
  /** @type {((inputs?: SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<SettingsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_settings(inputs)
      return zh_settings(inputs)
    }
  )
