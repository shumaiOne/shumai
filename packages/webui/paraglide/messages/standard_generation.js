/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Standard_GenerationInputs */

const en_standard_generation =
  /** @type {(inputs: Standard_GenerationInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Standard generation`)
  }

const zh_standard_generation =
  /** @type {(inputs: Standard_GenerationInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`标准生成`)
  }

/**
 * | output |
 * | --- |
 * | "Standard generation" |
 *
 * @param {Standard_GenerationInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const standard_generation =
  /** @type {((inputs?: Standard_GenerationInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Standard_GenerationInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_standard_generation(inputs)
      return zh_standard_generation(inputs)
    }
  )
