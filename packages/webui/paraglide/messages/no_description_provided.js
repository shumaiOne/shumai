/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Description_ProvidedInputs */

const en_no_description_provided =
  /** @type {(inputs: No_Description_ProvidedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`No description provided.`)
  }

const zh_no_description_provided =
  /** @type {(inputs: No_Description_ProvidedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`暂无描述。`)
  }

/**
 * | output |
 * | --- |
 * | "No description provided." |
 *
 * @param {No_Description_ProvidedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const no_description_provided =
  /** @type {((inputs?: No_Description_ProvidedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Description_ProvidedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_no_description_provided(inputs)
      return zh_no_description_provided(inputs)
    }
  )
