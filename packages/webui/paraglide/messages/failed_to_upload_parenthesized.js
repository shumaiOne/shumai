/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Upload_ParenthesizedInputs */

const en_failed_to_upload_parenthesized =
  /** @type {(inputs: Failed_To_Upload_ParenthesizedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`(Failed to upload)`)
  }

const zh_failed_to_upload_parenthesized =
  /** @type {(inputs: Failed_To_Upload_ParenthesizedInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`（上传失败）`)
  }

/**
 * | output |
 * | --- |
 * | "(Failed to upload)" |
 *
 * @param {Failed_To_Upload_ParenthesizedInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_upload_parenthesized =
  /** @type {((inputs?: Failed_To_Upload_ParenthesizedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Upload_ParenthesizedInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_failed_to_upload_parenthesized(inputs)
      return zh_failed_to_upload_parenthesized(inputs)
    }
  )
