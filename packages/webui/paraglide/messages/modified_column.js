/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Modified_ColumnInputs */

const en_modified_column = /** @type {(inputs: Modified_ColumnInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Modified`)
}

const zh_modified_column = /** @type {(inputs: Modified_ColumnInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`修改时间`)
}

/**
 * | output |
 * | --- |
 * | "Modified" |
 *
 * @param {Modified_ColumnInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const modified_column =
  /** @type {((inputs?: Modified_ColumnInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Modified_ColumnInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_modified_column(inputs)
      return zh_modified_column(inputs)
    }
  )
