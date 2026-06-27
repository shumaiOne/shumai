/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Position_And_ResizeInputs */

const en_position_and_resize =
  /** @type {(inputs: Position_And_ResizeInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Position and resize`)
  }

const zh_position_and_resize =
  /** @type {(inputs: Position_And_ResizeInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`定位和调整大小`)
  }

/**
 * | output |
 * | --- |
 * | "Position and resize" |
 *
 * @param {Position_And_ResizeInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const position_and_resize =
  /** @type {((inputs?: Position_And_ResizeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Position_And_ResizeInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_position_and_resize(inputs)
      return zh_position_and_resize(inputs)
    }
  )
