/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_ModelInputs */

const en_select_model = /** @type {(inputs: Select_ModelInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Select Model`)
}

const zh_select_model = /** @type {(inputs: Select_ModelInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`选择模型`)
}

/**
 * | output |
 * | --- |
 * | "Select Model" |
 *
 * @param {Select_ModelInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const select_model =
  /** @type {((inputs?: Select_ModelInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_ModelInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_select_model(inputs)
      return zh_select_model(inputs)
    }
  )
