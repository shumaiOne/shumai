/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Confirm_Download_DialogInputs */

const en_confirm_download_dialog =
  /** @type {(inputs: Confirm_Download_DialogInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Confirm Download`)
  }

const zh_confirm_download_dialog =
  /** @type {(inputs: Confirm_Download_DialogInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`确认下载`)
  }

/**
 * | output |
 * | --- |
 * | "Confirm Download" |
 *
 * @param {Confirm_Download_DialogInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const confirm_download_dialog =
  /** @type {((inputs?: Confirm_Download_DialogInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Confirm_Download_DialogInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_confirm_download_dialog(inputs)
      return zh_confirm_download_dialog(inputs)
    }
  )
