/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Allowed_DomainsInputs */

const en_allowed_domains = /** @type {(inputs: Allowed_DomainsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Allowed Domains`)
}

const zh_allowed_domains = /** @type {(inputs: Allowed_DomainsInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`允许的域名`)
}

/**
 * | output |
 * | --- |
 * | "Allowed Domains" |
 *
 * @param {Allowed_DomainsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const allowed_domains =
  /** @type {((inputs?: Allowed_DomainsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Allowed_DomainsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_allowed_domains(inputs)
      return zh_allowed_domains(inputs)
    }
  )
