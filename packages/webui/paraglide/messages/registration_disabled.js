/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Registration_DisabledInputs */

const en_registration_disabled =
  /** @type {(inputs: Registration_DisabledInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Registration Disabled`)
  }

const zh_registration_disabled =
  /** @type {(inputs: Registration_DisabledInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`注册已关闭`)
  }

/**
 * | output |
 * | --- |
 * | "Registration Disabled" |
 *
 * @param {Registration_DisabledInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const registration_disabled =
  /** @type {((inputs?: Registration_DisabledInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Registration_DisabledInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_registration_disabled(inputs)
      return zh_registration_disabled(inputs)
    }
  )
