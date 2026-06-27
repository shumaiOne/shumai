/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} YesterdayInputs */

const en_yesterday = /** @type {(inputs: YesterdayInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Yesterday`)
}

const zh_yesterday = /** @type {(inputs: YesterdayInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`昨天`)
}

/**
 * | output |
 * | --- |
 * | "Yesterday" |
 *
 * @param {YesterdayInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const yesterday =
  /** @type {((inputs?: YesterdayInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<YesterdayInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_yesterday(inputs)
      return zh_yesterday(inputs)
    }
  )
