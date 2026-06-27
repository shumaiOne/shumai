/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_DeleteInputs */

const en_failed_to_delete =
  /** @type {(inputs: Failed_To_DeleteInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Failed to delete`)
  }

const zh_failed_to_delete =
  /** @type {(inputs: Failed_To_DeleteInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`删除失败`)
  }

/**
 * | output |
 * | --- |
 * | "Failed to delete" |
 *
 * @param {Failed_To_DeleteInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_delete =
  /** @type {((inputs?: Failed_To_DeleteInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_DeleteInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_failed_to_delete(inputs)
      return zh_failed_to_delete(inputs)
    }
  )
