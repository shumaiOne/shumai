/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ version: NonNullable<unknown> }} VersionInputs */

const en_version = /** @type {(inputs: VersionInputs) => LocalizedString} */ (i) => {
  return /** @type {LocalizedString} */ (`Version ${i?.version}`)
}

const zh_version = /** @type {(inputs: VersionInputs) => LocalizedString} */ (i) => {
  return /** @type {LocalizedString} */ (`版本 ${i?.version}`)
}

/**
 * | output |
 * | --- |
 * | "Version {version}" |
 *
 * @param {VersionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const version =
  /** @type {((inputs: VersionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<VersionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_version(inputs)
      return zh_version(inputs)
    }
  )
