/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Thinking_HighInputs */

const en_thinking_high = /** @type {(inputs: Thinking_HighInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`High`)
}

const zh_thinking_high = /** @type {(inputs: Thinking_HighInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`高`)
}

/**
 * | output |
 * | --- |
 * | "High" |
 *
 * @param {Thinking_HighInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const thinking_high =
  /** @type {((inputs?: Thinking_HighInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Thinking_HighInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_thinking_high(inputs)
      return zh_thinking_high(inputs)
    }
  )
