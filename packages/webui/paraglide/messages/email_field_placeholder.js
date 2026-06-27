/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Email_Field_PlaceholderInputs */

const en_email_field_placeholder =
  /** @type {(inputs: Email_Field_PlaceholderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`john@example.com`)
  }

const zh_email_field_placeholder =
  /** @type {(inputs: Email_Field_PlaceholderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`zhangsan@example.com`)
  }

/**
 * | output |
 * | --- |
 * | "john@example.com" |
 *
 * @param {Email_Field_PlaceholderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const email_field_placeholder =
  /** @type {((inputs?: Email_Field_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Email_Field_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_email_field_placeholder(inputs)
      return zh_email_field_placeholder(inputs)
    }
  )
