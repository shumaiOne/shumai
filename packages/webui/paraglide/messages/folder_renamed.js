/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Folder_RenamedInputs */

const en_folder_renamed = /** @type {(inputs: Folder_RenamedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Folder renamed`)
}

const zh_folder_renamed = /** @type {(inputs: Folder_RenamedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`文件夹已重命名`)
}

/**
 * | output |
 * | --- |
 * | "Folder renamed" |
 *
 * @param {Folder_RenamedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const folder_renamed =
  /** @type {((inputs?: Folder_RenamedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Folder_RenamedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_folder_renamed(inputs)
      return zh_folder_renamed(inputs)
    }
  )
