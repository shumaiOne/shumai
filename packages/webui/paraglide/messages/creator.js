/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} CreatorInputs */

const en_creator = /** @type {(inputs: CreatorInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Creator`)
}

const zh_creator = /** @type {(inputs: CreatorInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`创建者`)
}

/**
 * | output |
 * | --- |
 * | "Creator" |
 *
 * @param {CreatorInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const creator =
  /** @type {((inputs?: CreatorInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<CreatorInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_creator(inputs)
      return zh_creator(inputs)
    }
  )
