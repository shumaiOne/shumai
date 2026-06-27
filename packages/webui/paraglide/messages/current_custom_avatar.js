/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Current_Custom_AvatarInputs */

const en_current_custom_avatar =
  /** @type {(inputs: Current_Custom_AvatarInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Current Custom Avatar`)
  }

const zh_current_custom_avatar =
  /** @type {(inputs: Current_Custom_AvatarInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`当前自定义头像`)
  }

/**
 * | output |
 * | --- |
 * | "Current Custom Avatar" |
 *
 * @param {Current_Custom_AvatarInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const current_custom_avatar =
  /** @type {((inputs?: Current_Custom_AvatarInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Current_Custom_AvatarInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_current_custom_avatar(inputs)
      return zh_current_custom_avatar(inputs)
    }
  )
