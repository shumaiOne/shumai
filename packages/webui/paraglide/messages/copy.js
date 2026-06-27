/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} CopyInputs */

const en_copy = /** @type {(inputs: CopyInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Copy`)
}

const zh_copy = /** @type {(inputs: CopyInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`复制`)
}

/**
 * | output |
 * | --- |
 * | "Copy" |
 *
 * @param {CopyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const copy =
  /** @type {((inputs?: CopyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<CopyInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_copy(inputs)
      return zh_copy(inputs)
    }
  )
