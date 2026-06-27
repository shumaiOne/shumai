/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} CreateInputs */

const en_create = /** @type {(inputs: CreateInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Create`)
}

const zh_create = /** @type {(inputs: CreateInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`创建`)
}

/**
 * | output |
 * | --- |
 * | "Create" |
 *
 * @param {CreateInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const create =
  /** @type {((inputs?: CreateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<CreateInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_create(inputs)
      return zh_create(inputs)
    }
  )
