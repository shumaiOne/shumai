/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Name_ColumnInputs */

const en_name_column = /** @type {(inputs: Name_ColumnInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Name`)
}

const zh_name_column = /** @type {(inputs: Name_ColumnInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`名称`)
}

/**
 * | output |
 * | --- |
 * | "Name" |
 *
 * @param {Name_ColumnInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const name_column =
  /** @type {((inputs?: Name_ColumnInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Name_ColumnInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_name_column(inputs)
      return zh_name_column(inputs)
    }
  )
