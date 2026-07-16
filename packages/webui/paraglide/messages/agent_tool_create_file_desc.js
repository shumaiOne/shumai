/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tool_Create_File_DescInputs */

const en_agent_tool_create_file_desc = /** @type {(inputs: Agent_Tool_Create_File_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Allows the agent to create and upload new files to Shumai.`)
};

const zh_agent_tool_create_file_desc = /** @type {(inputs: Agent_Tool_Create_File_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`允许智能体创建新文件并上传到 Shumai。`)
};

/**
* | output |
* | --- |
* | "Allows the agent to create and upload new files to Shumai." |
*
* @param {Agent_Tool_Create_File_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_create_file_desc = /** @type {((inputs?: Agent_Tool_Create_File_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Tool_Create_File_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tool_create_file_desc(inputs)
	return zh_agent_tool_create_file_desc(inputs)
});