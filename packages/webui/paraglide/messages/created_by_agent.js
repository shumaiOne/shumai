/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Created_By_AgentInputs */

const en_created_by_agent =
  /** @type {(inputs: Created_By_AgentInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Created by Agent`)
  }

const zh_created_by_agent =
  /** @type {(inputs: Created_By_AgentInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`由智能体创建`)
  }

/**
 * | output |
 * | --- |
 * | "Created by Agent" |
 *
 * @param {Created_By_AgentInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const created_by_agent =
  /** @type {((inputs?: Created_By_AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Created_By_AgentInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_created_by_agent(inputs)
      return zh_created_by_agent(inputs)
    }
  )
