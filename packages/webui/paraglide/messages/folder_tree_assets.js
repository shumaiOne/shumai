/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Folder_Tree_AssetsInputs */

const en_folder_tree_assets =
  /** @type {(inputs: Folder_Tree_AssetsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Assets`)
  }

const zh_folder_tree_assets =
  /** @type {(inputs: Folder_Tree_AssetsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`资产`)
  }

/**
 * | output |
 * | --- |
 * | "Assets" |
 *
 * @param {Folder_Tree_AssetsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const folder_tree_assets =
  /** @type {((inputs?: Folder_Tree_AssetsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Folder_Tree_AssetsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_folder_tree_assets(inputs)
      return zh_folder_tree_assets(inputs)
    }
  )
