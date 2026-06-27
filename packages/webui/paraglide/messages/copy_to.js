/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Copy_ToInputs */

const en_copy_to = /** @type {(inputs: Copy_ToInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Copy to`)
}

const zh_copy_to = /** @type {(inputs: Copy_ToInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`复制到`)
}

/**
 * | output |
 * | --- |
 * | "Copy to" |
 *
 * @param {Copy_ToInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const copy_to =
  /** @type {((inputs?: Copy_ToInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Copy_ToInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_copy_to(inputs)
      return zh_copy_to(inputs)
    }
  )
