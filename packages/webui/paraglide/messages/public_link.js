/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Public_LinkInputs */

const en_public_link = /** @type {(inputs: Public_LinkInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Public Link`)
}

const zh_public_link = /** @type {(inputs: Public_LinkInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`公开链接`)
}

/**
 * | output |
 * | --- |
 * | "Public Link" |
 *
 * @param {Public_LinkInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const public_link =
  /** @type {((inputs?: Public_LinkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Public_LinkInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_public_link(inputs)
      return zh_public_link(inputs)
    }
  )
