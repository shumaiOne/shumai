/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Rename_FolderInputs */

const en_rename_folder = /** @type {(inputs: Rename_FolderInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Rename Folder`)
}

const zh_rename_folder = /** @type {(inputs: Rename_FolderInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`重命名文件夹`)
}

/**
 * | output |
 * | --- |
 * | "Rename Folder" |
 *
 * @param {Rename_FolderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const rename_folder =
  /** @type {((inputs?: Rename_FolderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Rename_FolderInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_rename_folder(inputs)
      return zh_rename_folder(inputs)
    }
  )
