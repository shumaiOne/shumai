/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Folder_Structure_WarningInputs */

const en_folder_structure_warning =
  /** @type {(inputs: Folder_Structure_WarningInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `Folder hierarchy will be flattened. All nested files will be downloaded directly into your default download folder.`
    )
  }

const zh_folder_structure_warning =
  /** @type {(inputs: Folder_Structure_WarningInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `文件夹层级将被扁平化。所有嵌套文件将直接下载到您的默认下载文件夹中。`
    )
  }

/**
 * | output |
 * | --- |
 * | "Folder hierarchy will be flattened. All nested files will be downloaded directly into your default download folder." |
 *
 * @param {Folder_Structure_WarningInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const folder_structure_warning =
  /** @type {((inputs?: Folder_Structure_WarningInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Folder_Structure_WarningInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_folder_structure_warning(inputs)
      return zh_folder_structure_warning(inputs)
    }
  )
