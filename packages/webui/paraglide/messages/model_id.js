/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Model_IdInputs */

const en_model_id = /** @type {(inputs: Model_IdInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Model ID`)
}

const zh_model_id = /** @type {(inputs: Model_IdInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`模型 ID`)
}

/**
 * | output |
 * | --- |
 * | "Model ID" |
 *
 * @param {Model_IdInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const model_id =
  /** @type {((inputs?: Model_IdInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Model_IdInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_model_id(inputs)
      return zh_model_id(inputs)
    }
  )
