/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_SandboxInputs */

const en_agent_sandbox = /** @type {(inputs: Agent_SandboxInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Agent Sandbox`)
}

const zh_agent_sandbox = /** @type {(inputs: Agent_SandboxInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`智能体沙箱`)
}

/**
 * | output |
 * | --- |
 * | "Agent Sandbox" |
 *
 * @param {Agent_SandboxInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const agent_sandbox =
  /** @type {((inputs?: Agent_SandboxInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_SandboxInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_agent_sandbox(inputs)
      return zh_agent_sandbox(inputs)
    }
  )
