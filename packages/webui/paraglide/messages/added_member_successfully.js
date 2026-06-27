/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown> }} Added_Member_SuccessfullyInputs */

const en_added_member_successfully =
  /** @type {(inputs: Added_Member_SuccessfullyInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (`Added ${i?.name} successfully`)
  }

const zh_added_member_successfully =
  /** @type {(inputs: Added_Member_SuccessfullyInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (`已成功添加 ${i?.name}`)
  }

/**
 * | output |
 * | --- |
 * | "Added {name} successfully" |
 *
 * @param {Added_Member_SuccessfullyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const added_member_successfully =
  /** @type {((inputs: Added_Member_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Added_Member_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_added_member_successfully(inputs)
      return zh_added_member_successfully(inputs)
    }
  )
