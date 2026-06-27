/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} CancelInputs */

const en_cancel = /** @type {(inputs: CancelInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Cancel`)
}

const zh_cancel = /** @type {(inputs: CancelInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`取消`)
}

/**
 * | output |
 * | --- |
 * | "Cancel" |
 *
 * @param {CancelInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const cancel =
  /** @type {((inputs?: CancelInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<CancelInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_cancel(inputs)
      return zh_cancel(inputs)
    }
  )
