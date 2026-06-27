/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_MoveInputs */

const en_failed_to_move = /** @type {(inputs: Failed_To_MoveInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Failed to move`)
}

const zh_failed_to_move = /** @type {(inputs: Failed_To_MoveInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`移动失败`)
}

/**
 * | output |
 * | --- |
 * | "Failed to move" |
 *
 * @param {Failed_To_MoveInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const failed_to_move =
  /** @type {((inputs?: Failed_To_MoveInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_MoveInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_failed_to_move(inputs)
      return zh_failed_to_move(inputs)
    }
  )
