/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ApproveInputs */

const en_approve = /** @type {(inputs: ApproveInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Approve`)
}

const zh_approve = /** @type {(inputs: ApproveInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`批准`)
}

/**
 * | output |
 * | --- |
 * | "Approve" |
 *
 * @param {ApproveInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const approve =
  /** @type {((inputs?: ApproveInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ApproveInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_approve(inputs)
      return zh_approve(inputs)
    }
  )
