/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Emptying_TrashInputs */

const en_error_emptying_trash =
  /** @type {(inputs: Error_Emptying_TrashInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Error emptying trash`)
  }

const zh_error_emptying_trash =
  /** @type {(inputs: Error_Emptying_TrashInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`清空回收站出错`)
  }

/**
 * | output |
 * | --- |
 * | "Error emptying trash" |
 *
 * @param {Error_Emptying_TrashInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const error_emptying_trash =
  /** @type {((inputs?: Error_Emptying_TrashInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Emptying_TrashInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_error_emptying_trash(inputs)
      return zh_error_emptying_trash(inputs)
    }
  )
