/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Name_Is_RequiredInputs */

const en_name_is_required =
  /** @type {(inputs: Name_Is_RequiredInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Name is required`)
  }

const zh_name_is_required =
  /** @type {(inputs: Name_Is_RequiredInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`名称为必填项`)
  }

/**
 * | output |
 * | --- |
 * | "Name is required" |
 *
 * @param {Name_Is_RequiredInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const name_is_required =
  /** @type {((inputs?: Name_Is_RequiredInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Name_Is_RequiredInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_name_is_required(inputs)
      return zh_name_is_required(inputs)
    }
  )
