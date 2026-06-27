/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} GenerateInputs */

const en_generate = /** @type {(inputs: GenerateInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Generate`)
}

const zh_generate = /** @type {(inputs: GenerateInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`生成`)
}

/**
 * | output |
 * | --- |
 * | "Generate" |
 *
 * @param {GenerateInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const generate =
  /** @type {((inputs?: GenerateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<GenerateInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_generate(inputs)
      return zh_generate(inputs)
    }
  )
