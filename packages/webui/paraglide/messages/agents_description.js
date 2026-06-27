/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agents_DescriptionInputs */

const en_agents_description =
  /** @type {(inputs: Agents_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Manage AI agents and their personalities.`)
  }

const zh_agents_description =
  /** @type {(inputs: Agents_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`管理 AI 智能体及其个性。`)
  }

/**
 * | output |
 * | --- |
 * | "Manage AI agents and their personalities." |
 *
 * @param {Agents_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const agents_description =
  /** @type {((inputs?: Agents_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agents_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_agents_description(inputs)
      return zh_agents_description(inputs)
    }
  )
