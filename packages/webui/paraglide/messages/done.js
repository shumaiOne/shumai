/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} DoneInputs */

const en_done = /** @type {(inputs: DoneInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Done`)
}

const zh_done = /** @type {(inputs: DoneInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`完成`)
}

/**
 * | output |
 * | --- |
 * | "Done" |
 *
 * @param {DoneInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const done =
  /** @type {((inputs?: DoneInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<DoneInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_done(inputs)
      return zh_done(inputs)
    }
  )
