/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Link_VisibilityInputs */

const en_link_visibility = /** @type {(inputs: Link_VisibilityInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Link Visibility`)
}

const zh_link_visibility = /** @type {(inputs: Link_VisibilityInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`链接可见性`)
}

/**
 * | output |
 * | --- |
 * | "Link Visibility" |
 *
 * @param {Link_VisibilityInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const link_visibility =
  /** @type {((inputs?: Link_VisibilityInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Link_VisibilityInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_link_visibility(inputs)
      return zh_link_visibility(inputs)
    }
  )
