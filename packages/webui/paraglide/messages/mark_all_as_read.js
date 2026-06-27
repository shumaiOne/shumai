/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mark_All_As_ReadInputs */

const en_mark_all_as_read =
  /** @type {(inputs: Mark_All_As_ReadInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Mark all as read`)
  }

const zh_mark_all_as_read =
  /** @type {(inputs: Mark_All_As_ReadInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`全部标记为已读`)
  }

/**
 * | output |
 * | --- |
 * | "Mark all as read" |
 *
 * @param {Mark_All_As_ReadInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const mark_all_as_read =
  /** @type {((inputs?: Mark_All_As_ReadInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mark_All_As_ReadInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_mark_all_as_read(inputs)
      return zh_mark_all_as_read(inputs)
    }
  )
