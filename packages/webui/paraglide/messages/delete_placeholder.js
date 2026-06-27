/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_PlaceholderInputs */

const en_delete_placeholder =
  /** @type {(inputs: Delete_PlaceholderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`delete`)
  }

const zh_delete_placeholder =
  /** @type {(inputs: Delete_PlaceholderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`delete`)
  }

/**
 * | output |
 * | --- |
 * | "delete" |
 *
 * @param {Delete_PlaceholderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const delete_placeholder =
  /** @type {((inputs?: Delete_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_delete_placeholder(inputs)
      return zh_delete_placeholder(inputs)
    }
  )
