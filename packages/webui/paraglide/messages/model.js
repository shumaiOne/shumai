/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ModelInputs */

const en_model = /** @type {(inputs: ModelInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Model`)
}

const zh_model = /** @type {(inputs: ModelInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`模型`)
}

/**
 * | output |
 * | --- |
 * | "Model" |
 *
 * @param {ModelInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const model =
  /** @type {((inputs?: ModelInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ModelInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_model(inputs)
      return zh_model(inputs)
    }
  )
