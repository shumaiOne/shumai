/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quick_ReasoningInputs */

const en_quick_reasoning = /** @type {(inputs: Quick_ReasoningInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Quick reasoning`)
}

const zh_quick_reasoning = /** @type {(inputs: Quick_ReasoningInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`快速推理`)
}

/**
 * | output |
 * | --- |
 * | "Quick reasoning" |
 *
 * @param {Quick_ReasoningInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const quick_reasoning =
  /** @type {((inputs?: Quick_ReasoningInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quick_ReasoningInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_quick_reasoning(inputs)
      return zh_quick_reasoning(inputs)
    }
  )
