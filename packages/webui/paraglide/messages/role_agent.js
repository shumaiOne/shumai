/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Role_AgentInputs */

const en_role_agent = /** @type {(inputs: Role_AgentInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`Agent`)
}

const zh_role_agent = /** @type {(inputs: Role_AgentInputs) => LocalizedString} */ () => {
  return /** @type {LocalizedString} */ (`智能体`)
}

/**
 * | output |
 * | --- |
 * | "Agent" |
 *
 * @param {Role_AgentInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const role_agent =
  /** @type {((inputs?: Role_AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Role_AgentInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_role_agent(inputs)
      return zh_role_agent(inputs)
    }
  )
