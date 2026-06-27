/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Soul_PlaceholderInputs */

const en_agent_soul_placeholder = /** @type {(inputs: Agent_Soul_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Describe the agent's personality, tone, and behavior...`)
};

const zh_agent_soul_placeholder = /** @type {(inputs: Agent_Soul_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`描述智能体的个性、语调和行为...`)
};

/**
* | output |
* | --- |
* | "Describe the agent's personality, tone, and behavior..." |
*
* @param {Agent_Soul_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_soul_placeholder = /** @type {((inputs?: Agent_Soul_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Soul_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_soul_placeholder(inputs)
	return zh_agent_soul_placeholder(inputs)
});