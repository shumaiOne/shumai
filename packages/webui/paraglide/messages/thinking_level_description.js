/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Thinking_Level_DescriptionInputs */

const en_thinking_level_description =
  /** @type {(inputs: Thinking_Level_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Control the depth of reasoning for complex tasks.`)
  }

const zh_thinking_level_description =
  /** @type {(inputs: Thinking_Level_DescriptionInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`控制复杂任务的推理深度。`)
  }

/**
 * | output |
 * | --- |
 * | "Control the depth of reasoning for complex tasks." |
 *
 * @param {Thinking_Level_DescriptionInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const thinking_level_description =
  /** @type {((inputs?: Thinking_Level_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Thinking_Level_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_thinking_level_description(inputs)
      return zh_thinking_level_description(inputs)
    }
  )
