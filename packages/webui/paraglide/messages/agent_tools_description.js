/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tools_DescriptionInputs */

const en_agent_tools_description = /** @type {(inputs: Agent_Tools_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Configure which tools the agent is permitted to use.`)
};

const zh_agent_tools_description = /** @type {(inputs: Agent_Tools_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`配置允许智能体使用的工具。`)
};

/**
* | output |
* | --- |
* | "Configure which tools the agent is permitted to use." |
*
* @param {Agent_Tools_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tools_description = /** @type {((inputs?: Agent_Tools_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Tools_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tools_description(inputs)
	return zh_agent_tools_description(inputs)
});