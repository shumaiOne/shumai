/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tool_Create_Version_NameInputs */

const en_agent_tool_create_version_name = /** @type {(inputs: Agent_Tool_Create_Version_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create Version`)
};

const zh_agent_tool_create_version_name = /** @type {(inputs: Agent_Tool_Create_Version_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创建版本`)
};

/**
* | output |
* | --- |
* | "Create Version" |
*
* @param {Agent_Tool_Create_Version_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_create_version_name = /** @type {((inputs?: Agent_Tool_Create_Version_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Tool_Create_Version_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tool_create_version_name(inputs)
	return zh_agent_tool_create_version_name(inputs)
});