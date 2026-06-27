/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Enlarged_ViewInputs */

const en_enlarged_view = /** @type {(inputs: Enlarged_ViewInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Enlarged view`)
}

const zh_enlarged_view = /** @type {(inputs: Enlarged_ViewInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`放大视图`)
}

/**
 * | output |
 * | --- |
 * | "Enlarged view" |
 *
 * @param {Enlarged_ViewInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const enlarged_view =
  /** @type {((inputs?: Enlarged_ViewInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Enlarged_ViewInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_enlarged_view(inputs)
      return zh_enlarged_view(inputs)
    }
  )
