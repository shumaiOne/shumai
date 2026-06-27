/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Enable_TimestampInputs */

const en_enable_timestamp =
  /** @type {(inputs: Enable_TimestampInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Enable Timestamp`)
  }

const zh_enable_timestamp =
  /** @type {(inputs: Enable_TimestampInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`启用时间戳`)
  }

/**
 * | output |
 * | --- |
 * | "Enable Timestamp" |
 *
 * @param {Enable_TimestampInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const enable_timestamp =
  /** @type {((inputs?: Enable_TimestampInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Enable_TimestampInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_enable_timestamp(inputs)
      return zh_enable_timestamp(inputs)
    }
  )
