/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Empty_Trash_DescriptionInputs */

const en_empty_trash_description =
  /** @type {(inputs: Empty_Trash_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `All items in the recently deleted folder will be permanently removed both from the database and from storage. This action cannot be undone.`
    )
  }

const zh_empty_trash_description =
  /** @type {(inputs: Empty_Trash_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `回收站中的所有项目将从数据库和存储中永久删除。此操作无法撤销。`
    )
  }

/**
 * | output |
 * | --- |
 * | "All items in the recently deleted folder will be permanently removed both from the database and from storage. This action cannot be undone." |
 *
 * @param {Empty_Trash_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const empty_trash_description =
  /** @type {((inputs?: Empty_Trash_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Empty_Trash_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_empty_trash_description(inputs)
      return zh_empty_trash_description(inputs)
    }
  )
