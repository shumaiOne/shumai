/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Toggle_CheckedInputs */

const en_toggle_checked = /** @type {(inputs: Toggle_CheckedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Checked`)
}

const zh_toggle_checked = /** @type {(inputs: Toggle_CheckedInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`已选中`)
}

/**
 * | output |
 * | --- |
 * | "Checked" |
 *
 * @param {Toggle_CheckedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const toggle_checked =
  /** @type {((inputs?: Toggle_CheckedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Toggle_CheckedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_toggle_checked(inputs)
      return zh_toggle_checked(inputs)
    }
  )
