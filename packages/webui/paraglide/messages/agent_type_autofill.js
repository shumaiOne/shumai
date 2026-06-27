/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Type_AutofillInputs */

const en_agent_type_autofill =
  /** @type {(inputs: Agent_Type_AutofillInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Autofill`)
  }

const zh_agent_type_autofill =
  /** @type {(inputs: Agent_Type_AutofillInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`自动填充`)
  }

/**
 * | output |
 * | --- |
 * | "Autofill" |
 *
 * @param {Agent_Type_AutofillInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const agent_type_autofill =
  /** @type {((inputs?: Agent_Type_AutofillInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Type_AutofillInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_agent_type_autofill(inputs)
      return zh_agent_type_autofill(inputs)
    }
  )
