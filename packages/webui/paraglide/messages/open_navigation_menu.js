/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Open_Navigation_MenuInputs */

const en_open_navigation_menu =
  /** @type {(inputs: Open_Navigation_MenuInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Open navigation menu`)
  }

const zh_open_navigation_menu =
  /** @type {(inputs: Open_Navigation_MenuInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`打开导航菜单`)
  }

/**
 * | output |
 * | --- |
 * | "Open navigation menu" |
 *
 * @param {Open_Navigation_MenuInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const open_navigation_menu =
  /** @type {((inputs?: Open_Navigation_MenuInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Open_Navigation_MenuInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_open_navigation_menu(inputs)
      return zh_open_navigation_menu(inputs)
    }
  )
