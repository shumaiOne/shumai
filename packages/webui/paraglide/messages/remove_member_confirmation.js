/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown>, type: NonNullable<unknown> }} Remove_Member_ConfirmationInputs */

const en_remove_member_confirmation =
  /** @type {(inputs: Remove_Member_ConfirmationInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (
      `Are you sure you want to remove ${i?.name} from this ${i?.type}? This action cannot be undone.`
    )
  }

const zh_remove_member_confirmation =
  /** @type {(inputs: Remove_Member_ConfirmationInputs) => LocalizedString} */ (i) => {
    return /** @type {LocalizedString} */ (
      `确定要从此${i?.type}中移除 ${i?.name} 吗？此操作无法撤销。`
    )
  }

/**
 * | output |
 * | --- |
 * | "Are you sure you want to remove {name} from this {type}? This action cannot be undone." |
 *
 * @param {Remove_Member_ConfirmationInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const remove_member_confirmation =
  /** @type {((inputs: Remove_Member_ConfirmationInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Remove_Member_ConfirmationInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_remove_member_confirmation(inputs)
      return zh_remove_member_confirmation(inputs)
    }
  )
