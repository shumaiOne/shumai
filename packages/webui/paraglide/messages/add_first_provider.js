/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_First_ProviderInputs */

const en_add_first_provider =
  /** @type {(inputs: Add_First_ProviderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Add your first AI provider to get started.`)
  }

const zh_add_first_provider =
  /** @type {(inputs: Add_First_ProviderInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`添加您的第一个 AI 提供商以开始使用。`)
  }

/**
 * | output |
 * | --- |
 * | "Add your first AI provider to get started." |
 *
 * @param {Add_First_ProviderInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const add_first_provider =
  /** @type {((inputs?: Add_First_ProviderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_First_ProviderInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_add_first_provider(inputs)
      return zh_add_first_provider(inputs)
    }
  )
