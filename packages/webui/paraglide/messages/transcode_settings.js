/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Transcode_SettingsInputs */

const en_transcode_settings =
  /** @type {(inputs: Transcode_SettingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Transcode Settings`)
  }

const zh_transcode_settings =
  /** @type {(inputs: Transcode_SettingsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`转码设置`)
  }

/**
 * | output |
 * | --- |
 * | "Transcode Settings" |
 *
 * @param {Transcode_SettingsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const transcode_settings =
  /** @type {((inputs?: Transcode_SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Transcode_SettingsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_transcode_settings(inputs)
      return zh_transcode_settings(inputs)
    }
  )
