/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Trash_Emptied_SuccessfullyInputs */

const en_trash_emptied_successfully =
  /** @type {(inputs: Trash_Emptied_SuccessfullyInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Trash emptied successfully`)
  }

const zh_trash_emptied_successfully =
  /** @type {(inputs: Trash_Emptied_SuccessfullyInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`回收站已清空`)
  }

/**
 * | output |
 * | --- |
 * | "Trash emptied successfully" |
 *
 * @param {Trash_Emptied_SuccessfullyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const trash_emptied_successfully =
  /** @type {((inputs?: Trash_Emptied_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Trash_Emptied_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_trash_emptied_successfully(inputs)
      return zh_trash_emptied_successfully(inputs)
    }
  )
