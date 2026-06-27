/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Name_PlaceholderInputs */

const en_name_placeholder =
  /** @type {(inputs: Name_PlaceholderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`John Doe`)
  }

const zh_name_placeholder =
  /** @type {(inputs: Name_PlaceholderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`张三`)
  }

/**
 * | output |
 * | --- |
 * | "John Doe" |
 *
 * @param {Name_PlaceholderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const name_placeholder =
  /** @type {((inputs?: Name_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Name_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_name_placeholder(inputs)
      return zh_name_placeholder(inputs)
    }
  )
