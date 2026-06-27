/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Field_Deleted_SuccessfullyInputs */

const en_field_deleted_successfully =
  /** @type {(inputs: Field_Deleted_SuccessfullyInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Field deleted successfully`)
  }

const zh_field_deleted_successfully =
  /** @type {(inputs: Field_Deleted_SuccessfullyInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`字段删除成功`)
  }

/**
 * | output |
 * | --- |
 * | "Field deleted successfully" |
 *
 * @param {Field_Deleted_SuccessfullyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const field_deleted_successfully =
  /** @type {((inputs?: Field_Deleted_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_Deleted_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_field_deleted_successfully(inputs)
      return zh_field_deleted_successfully(inputs)
    }
  )
