/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} CloseInputs */

const en_close = /** @type {(inputs: CloseInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Close`)
}

const zh_close = /** @type {(inputs: CloseInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`关闭`)
}

/**
 * | output |
 * | --- |
 * | "Close" |
 *
 * @param {CloseInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const close =
  /** @type {((inputs?: CloseInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<CloseInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_close(inputs)
      return zh_close(inputs)
    }
  )
