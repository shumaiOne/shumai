/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_SoulInputs */

const en_agent_soul = /** @type {(inputs: Agent_SoulInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Agent Soul (Personality)`)
}

const zh_agent_soul = /** @type {(inputs: Agent_SoulInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`智能体灵魂（个性）`)
}

/**
 * | output |
 * | --- |
 * | "Agent Soul (Personality)" |
 *
 * @param {Agent_SoulInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const agent_soul =
  /** @type {((inputs?: Agent_SoulInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_SoulInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_agent_soul(inputs)
      return zh_agent_soul(inputs)
    }
  )
