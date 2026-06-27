/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Created_AtInputs */

const en_created_at = /** @type {(inputs: Created_AtInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Created At`)
}

const zh_created_at = /** @type {(inputs: Created_AtInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`创建时间`)
}

/**
 * | output |
 * | --- |
 * | "Created At" |
 *
 * @param {Created_AtInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const created_at =
  /** @type {((inputs?: Created_AtInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Created_AtInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_created_at(inputs)
      return zh_created_at(inputs)
    }
  )
