/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} SizeInputs */

const en_size = /** @type {(inputs: SizeInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Size`)
}

const zh_size = /** @type {(inputs: SizeInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`大小`)
}

/**
 * | output |
 * | --- |
 * | "Size" |
 *
 * @param {SizeInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const size =
  /** @type {((inputs?: SizeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<SizeInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_size(inputs)
      return zh_size(inputs)
    }
  )
