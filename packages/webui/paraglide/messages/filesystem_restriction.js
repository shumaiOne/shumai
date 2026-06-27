/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Filesystem_RestrictionInputs */

const en_filesystem_restriction =
  /** @type {(inputs: Filesystem_RestrictionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Filesystem Restriction`)
  }

const zh_filesystem_restriction =
  /** @type {(inputs: Filesystem_RestrictionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`文件系统限制`)
  }

/**
 * | output |
 * | --- |
 * | "Filesystem Restriction" |
 *
 * @param {Filesystem_RestrictionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const filesystem_restriction =
  /** @type {((inputs?: Filesystem_RestrictionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Filesystem_RestrictionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_filesystem_restriction(inputs)
      return zh_filesystem_restriction(inputs)
    }
  )
