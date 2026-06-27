/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Empty_Trash_TitleInputs */

const en_empty_trash_title =
  /** @type {(inputs: Empty_Trash_TitleInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Empty Trash?`)
  }

const zh_empty_trash_title =
  /** @type {(inputs: Empty_Trash_TitleInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`清空回收站？`)
  }

/**
 * | output |
 * | --- |
 * | "Empty Trash?" |
 *
 * @param {Empty_Trash_TitleInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const empty_trash_title =
  /** @type {((inputs?: Empty_Trash_TitleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Empty_Trash_TitleInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_empty_trash_title(inputs)
      return zh_empty_trash_title(inputs)
    }
  )
