/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tool_List_Assets_DescInputs */

const en_agent_tool_list_assets_desc = /** @type {(inputs: Agent_Tool_List_Assets_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Allows the agent to list folders and browse files in Shumai.`)
};

const zh_agent_tool_list_assets_desc = /** @type {(inputs: Agent_Tool_List_Assets_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`允许智能体列出文件夹并浏览 Shumai 中的文件。`)
};

/**
* | output |
* | --- |
* | "Allows the agent to list folders and browse files in Shumai." |
*
* @param {Agent_Tool_List_Assets_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_list_assets_desc = /** @type {((inputs?: Agent_Tool_List_Assets_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Tool_List_Assets_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tool_list_assets_desc(inputs)
	return zh_agent_tool_list_assets_desc(inputs)
});