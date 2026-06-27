/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Generate_LinkInputs */

const en_generate_link = /** @type {(inputs: Generate_LinkInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Generate Link`)
}

const zh_generate_link = /** @type {(inputs: Generate_LinkInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`生成链接`)
}

/**
 * | output |
 * | --- |
 * | "Generate Link" |
 *
 * @param {Generate_LinkInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const generate_link =
  /** @type {((inputs?: Generate_LinkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Generate_LinkInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_generate_link(inputs)
      return zh_generate_link(inputs)
    }
  )
