/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} AiInputs */

const en_ai = /** @type {(inputs: AiInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`AI`)
}

const zh_ai = /** @type {(inputs: AiInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`AI`)
}

/**
 * | output |
 * | --- |
 * | "AI" |
 *
 * @param {AiInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const ai =
  /** @type {((inputs?: AiInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<AiInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_ai(inputs)
      return zh_ai(inputs)
    }
  )
