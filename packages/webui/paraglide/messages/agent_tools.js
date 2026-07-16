/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_ToolsInputs */

const en_agent_tools = /** @type {(inputs: Agent_ToolsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Tools`)
};

const zh_agent_tools = /** @type {(inputs: Agent_ToolsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`工具`)
};

/**
* | output |
* | --- |
* | "Tools" |
*
* @param {Agent_ToolsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tools = /** @type {((inputs?: Agent_ToolsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_ToolsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tools(inputs)
	return zh_agent_tools(inputs)
});