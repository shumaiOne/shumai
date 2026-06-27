/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_NameInputs */

const en_agent_name = /** @type {(inputs: Agent_NameInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Agent Name`)
}

const zh_agent_name = /** @type {(inputs: Agent_NameInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`智能体名称`)
}

/**
 * | output |
 * | --- |
 * | "Agent Name" |
 *
 * @param {Agent_NameInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const agent_name =
  /** @type {((inputs?: Agent_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_NameInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_agent_name(inputs)
      return zh_agent_name(inputs)
    }
  )
