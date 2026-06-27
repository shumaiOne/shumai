/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Updated_SuccessfullyInputs */

const en_agent_updated_successfully =
  /** @type {(inputs: Agent_Updated_SuccessfullyInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Agent updated successfully`)
  }

const zh_agent_updated_successfully =
  /** @type {(inputs: Agent_Updated_SuccessfullyInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`智能体更新成功`)
  }

/**
 * | output |
 * | --- |
 * | "Agent updated successfully" |
 *
 * @param {Agent_Updated_SuccessfullyInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const agent_updated_successfully =
  /** @type {((inputs?: Agent_Updated_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Updated_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_agent_updated_successfully(inputs)
      return zh_agent_updated_successfully(inputs)
    }
  )
