/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Selected_Files_Will_Be_PreparedInputs */

const en_selected_files_will_be_prepared =
  /** @type {(inputs: Selected_Files_Will_Be_PreparedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `Selected files and folders will be prepared for download.`
    )
  }

const zh_selected_files_will_be_prepared =
  /** @type {(inputs: Selected_Files_Will_Be_PreparedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`所选文件和文件夹将被准备下载。`)
  }

/**
 * | output |
 * | --- |
 * | "Selected files and folders will be prepared for download." |
 *
 * @param {Selected_Files_Will_Be_PreparedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const selected_files_will_be_prepared =
  /** @type {((inputs?: Selected_Files_Will_Be_PreparedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Selected_Files_Will_Be_PreparedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_selected_files_will_be_prepared(inputs)
      return zh_selected_files_will_be_prepared(inputs)
    }
  )
