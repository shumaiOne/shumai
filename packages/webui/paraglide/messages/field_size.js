/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Field_SizeInputs */

const en_field_size = /** @type {(inputs: Field_SizeInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Size`)
}

const zh_field_size = /** @type {(inputs: Field_SizeInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`大小`)
}

/**
 * | output |
 * | --- |
 * | "Size" |
 *
 * @param {Field_SizeInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const field_size =
  /** @type {((inputs?: Field_SizeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_SizeInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_field_size(inputs)
      return zh_field_size(inputs)
    }
  )
