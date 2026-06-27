/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} File_Card_ProcessingInputs */

const en_file_card_processing =
  /** @type {(inputs: File_Card_ProcessingInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Processing`)
  }

const zh_file_card_processing =
  /** @type {(inputs: File_Card_ProcessingInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`处理中`)
  }

/**
 * | output |
 * | --- |
 * | "Processing" |
 *
 * @param {File_Card_ProcessingInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const file_card_processing =
  /** @type {((inputs?: File_Card_ProcessingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<File_Card_ProcessingInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_file_card_processing(inputs)
      return zh_file_card_processing(inputs)
    }
  )
