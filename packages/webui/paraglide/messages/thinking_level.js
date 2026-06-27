/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Thinking_LevelInputs */

const en_thinking_level = /** @type {(inputs: Thinking_LevelInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Thinking Level`)
}

const zh_thinking_level = /** @type {(inputs: Thinking_LevelInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`思考级别`)
}

/**
 * | output |
 * | --- |
 * | "Thinking Level" |
 *
 * @param {Thinking_LevelInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const thinking_level =
  /** @type {((inputs?: Thinking_LevelInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Thinking_LevelInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_thinking_level(inputs)
      return zh_thinking_level(inputs)
    }
  )
