/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Description_Optional_PlaceholderInputs */

const en_description_optional_placeholder =
  /** @type {(inputs: Description_Optional_PlaceholderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Description (Optional)`)
  }

const zh_description_optional_placeholder =
  /** @type {(inputs: Description_Optional_PlaceholderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`描述（可选）`)
  }

/**
 * | output |
 * | --- |
 * | "Description (Optional)" |
 *
 * @param {Description_Optional_PlaceholderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const description_optional_placeholder =
  /** @type {((inputs?: Description_Optional_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Description_Optional_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_description_optional_placeholder(inputs)
      return zh_description_optional_placeholder(inputs)
    }
  )
