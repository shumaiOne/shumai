/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} File_Not_FoundInputs */

const en_file_not_found = /** @type {(inputs: File_Not_FoundInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`File not found.`)
}

const zh_file_not_found = /** @type {(inputs: File_Not_FoundInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`文件未找到。`)
}

/**
 * | output |
 * | --- |
 * | "File not found." |
 *
 * @param {File_Not_FoundInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const file_not_found =
  /** @type {((inputs?: File_Not_FoundInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<File_Not_FoundInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_file_not_found(inputs)
      return zh_file_not_found(inputs)
    }
  )
