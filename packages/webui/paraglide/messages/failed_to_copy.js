/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_CopyInputs */

const en_failed_to_copy = /** @type {(inputs: Failed_To_CopyInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Failed to copy`)
}

const zh_failed_to_copy = /** @type {(inputs: Failed_To_CopyInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`复制失败`)
}

/**
 * | output |
 * | --- |
 * | "Failed to copy" |
 *
 * @param {Failed_To_CopyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_copy =
  /** @type {((inputs?: Failed_To_CopyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_CopyInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_failed_to_copy(inputs)
      return zh_failed_to_copy(inputs)
    }
  )
