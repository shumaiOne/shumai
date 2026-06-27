/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} GridInputs */

const en_grid = /** @type {(inputs: GridInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Grid`)
}

const zh_grid = /** @type {(inputs: GridInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`网格`)
}

/**
 * | output |
 * | --- |
 * | "Grid" |
 *
 * @param {GridInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const grid =
  /** @type {((inputs?: GridInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<GridInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_grid(inputs)
      return zh_grid(inputs)
    }
  )
