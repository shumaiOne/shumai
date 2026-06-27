/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} _NewInputs */

const en__new = /** @type {(inputs: _NewInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`New`)
}

const zh__new = /** @type {(inputs: _NewInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`新建`)
}

/**
 * | output |
 * | --- |
 * | "New" |
 *
 * @param {_NewInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
const _new =
  /** @type {((inputs?: _NewInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<_NewInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en__new(inputs)
      return zh__new(inputs)
    }
  )
export { _new as 'new' }
