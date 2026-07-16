/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tool_List_Assets_NameInputs */

const en_agent_tool_list_assets_name = /** @type {(inputs: Agent_Tool_List_Assets_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Browse Shumai`)
};

const zh_agent_tool_list_assets_name = /** @type {(inputs: Agent_Tool_List_Assets_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`浏览 Shumai`)
};

/**
* | output |
* | --- |
* | "Browse Shumai" |
*
* @param {Agent_Tool_List_Assets_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_list_assets_name = /** @type {((inputs?: Agent_Tool_List_Assets_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Tool_List_Assets_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tool_list_assets_name(inputs)
	return zh_agent_tool_list_assets_name(inputs)
});