/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Click_To_Copy_LinkInputs */

const en_click_to_copy_link =
  /** @type {(inputs: Click_To_Copy_LinkInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Click to copy link`)
  }

const zh_click_to_copy_link =
  /** @type {(inputs: Click_To_Copy_LinkInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`点击复制链接`)
  }

/**
 * | output |
 * | --- |
 * | "Click to copy link" |
 *
 * @param {Click_To_Copy_LinkInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const click_to_copy_link =
  /** @type {((inputs?: Click_To_Copy_LinkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Click_To_Copy_LinkInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_click_to_copy_link(inputs)
      return zh_click_to_copy_link(inputs)
    }
  )
