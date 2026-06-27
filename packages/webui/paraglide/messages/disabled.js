/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} DisabledInputs */

const en_disabled = /** @type {(inputs: DisabledInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Disabled`)
}

const zh_disabled = /** @type {(inputs: DisabledInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`已禁用`)
}

/**
 * | output |
 * | --- |
 * | "Disabled" |
 *
 * @param {DisabledInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const disabled =
  /** @type {((inputs?: DisabledInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<DisabledInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_disabled(inputs)
      return zh_disabled(inputs)
    }
  )
