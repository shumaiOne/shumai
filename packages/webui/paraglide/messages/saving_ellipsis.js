/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Saving_EllipsisInputs */

const en_saving_ellipsis = /** @type {(inputs: Saving_EllipsisInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Saving...`)
}

const zh_saving_ellipsis = /** @type {(inputs: Saving_EllipsisInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`保存中...`)
}

/**
 * | output |
 * | --- |
 * | "Saving..." |
 *
 * @param {Saving_EllipsisInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const saving_ellipsis =
  /** @type {((inputs?: Saving_EllipsisInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Saving_EllipsisInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_saving_ellipsis(inputs)
      return zh_saving_ellipsis(inputs)
    }
  )
