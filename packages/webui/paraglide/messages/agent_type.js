/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_TypeInputs */

const en_agent_type = /** @type {(inputs: Agent_TypeInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Agent Type`)
}

const zh_agent_type = /** @type {(inputs: Agent_TypeInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`智能体类型`)
}

/**
 * | output |
 * | --- |
 * | "Agent Type" |
 *
 * @param {Agent_TypeInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const agent_type =
  /** @type {((inputs?: Agent_TypeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_TypeInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_agent_type(inputs)
      return zh_agent_type(inputs)
    }
  )
