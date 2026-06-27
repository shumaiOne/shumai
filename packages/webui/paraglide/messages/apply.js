/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ApplyInputs */

const en_apply = /** @type {(inputs: ApplyInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Apply`)
}

const zh_apply = /** @type {(inputs: ApplyInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`应用`)
}

/**
 * | output |
 * | --- |
 * | "Apply" |
 *
 * @param {ApplyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const apply =
  /** @type {((inputs?: ApplyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ApplyInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_apply(inputs)
      return zh_apply(inputs)
    }
  )
