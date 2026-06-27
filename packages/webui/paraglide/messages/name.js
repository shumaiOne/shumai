/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} NameInputs */

const en_name = /** @type {(inputs: NameInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Name`)
}

const zh_name = /** @type {(inputs: NameInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`名称`)
}

/**
 * | output |
 * | --- |
 * | "Name" |
 *
 * @param {NameInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const name =
  /** @type {((inputs?: NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<NameInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_name(inputs)
      return zh_name(inputs)
    }
  )
