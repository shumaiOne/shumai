/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Renamed_SuccessfullyInputs */

const en_renamed_successfully =
  /** @type {(inputs: Renamed_SuccessfullyInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Renamed successfully`)
  }

const zh_renamed_successfully =
  /** @type {(inputs: Renamed_SuccessfullyInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`重命名成功`)
  }

/**
 * | output |
 * | --- |
 * | "Renamed successfully" |
 *
 * @param {Renamed_SuccessfullyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const renamed_successfully =
  /** @type {((inputs?: Renamed_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Renamed_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_renamed_successfully(inputs)
      return zh_renamed_successfully(inputs)
    }
  )
