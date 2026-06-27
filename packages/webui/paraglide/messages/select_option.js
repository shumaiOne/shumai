/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_OptionInputs */

const en_select_option = /** @type {(inputs: Select_OptionInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Select option`)
}

const zh_select_option = /** @type {(inputs: Select_OptionInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`选择选项`)
}

/**
 * | output |
 * | --- |
 * | "Select option" |
 *
 * @param {Select_OptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_option =
  /** @type {((inputs?: Select_OptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_OptionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_select_option(inputs)
      return zh_select_option(inputs)
    }
  )
