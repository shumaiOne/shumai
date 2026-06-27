/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} New_OptionInputs */

const en_new_option = /** @type {(inputs: New_OptionInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`New Option`)
}

const zh_new_option = /** @type {(inputs: New_OptionInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`新选项`)
}

/**
 * | output |
 * | --- |
 * | "New Option" |
 *
 * @param {New_OptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const new_option =
  /** @type {((inputs?: New_OptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<New_OptionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_new_option(inputs)
      return zh_new_option(inputs)
    }
  )
