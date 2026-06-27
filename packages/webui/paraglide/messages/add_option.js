/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_OptionInputs */

const en_add_option = /** @type {(inputs: Add_OptionInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Add option`)
}

const zh_add_option = /** @type {(inputs: Add_OptionInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`添加选项`)
}

/**
 * | output |
 * | --- |
 * | "Add option" |
 *
 * @param {Add_OptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const add_option =
  /** @type {((inputs?: Add_OptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_OptionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_add_option(inputs)
      return zh_add_option(inputs)
    }
  )
