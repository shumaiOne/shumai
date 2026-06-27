/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Creating_AccountInputs */

const en_creating_account =
  /** @type {(inputs: Creating_AccountInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Creating account...`)
  }

const zh_creating_account =
  /** @type {(inputs: Creating_AccountInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`创建账户中...`)
  }

/**
 * | output |
 * | --- |
 * | "Creating account..." |
 *
 * @param {Creating_AccountInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const creating_account =
  /** @type {((inputs?: Creating_AccountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Creating_AccountInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_creating_account(inputs)
      return zh_creating_account(inputs)
    }
  )
