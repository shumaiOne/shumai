/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} LoopInputs */

const en_loop = /** @type {(inputs: LoopInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Loop`)
}

const zh_loop = /** @type {(inputs: LoopInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`循环`)
}

/**
 * | output |
 * | --- |
 * | "Loop" |
 *
 * @param {LoopInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const loop =
  /** @type {((inputs?: LoopInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<LoopInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_loop(inputs)
      return zh_loop(inputs)
    }
  )
