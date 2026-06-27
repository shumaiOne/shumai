/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Updated_AgoInputs */

const en_updated_ago = /** @type {(inputs: Updated_AgoInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Updated`)
}

const zh_updated_ago = /** @type {(inputs: Updated_AgoInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`更新于`)
}

/**
 * | output |
 * | --- |
 * | "Updated" |
 *
 * @param {Updated_AgoInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const updated_ago =
  /** @type {((inputs?: Updated_AgoInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Updated_AgoInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_updated_ago(inputs)
      return zh_updated_ago(inputs)
    }
  )
