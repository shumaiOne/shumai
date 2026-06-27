/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Balanced_ThoughtInputs */

const en_balanced_thought =
  /** @type {(inputs: Balanced_ThoughtInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Balanced thought`)
  }

const zh_balanced_thought =
  /** @type {(inputs: Balanced_ThoughtInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`平衡思考`)
  }

/**
 * | output |
 * | --- |
 * | "Balanced thought" |
 *
 * @param {Balanced_ThoughtInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const balanced_thought =
  /** @type {((inputs?: Balanced_ThoughtInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Balanced_ThoughtInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_balanced_thought(inputs)
      return zh_balanced_thought(inputs)
    }
  )
