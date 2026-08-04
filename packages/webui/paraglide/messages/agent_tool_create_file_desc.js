/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tool_Create_File_DescInputs */

const en_agent_tool_create_file_desc = /** @type {(inputs: Agent_Tool_Create_File_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Allows the agent to create files in Shumai, either by uploading a local file or by providing the file name and content directly.`)
};

const zh_agent_tool_create_file_desc = /** @type {(inputs: Agent_Tool_Create_File_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`允许智能体在 Shumai 中创建文件，既可以通过上传本地文件，也可以直接提供文件名和内容。`)
};

/**
* | output |
* | --- |
* | "Allows the agent to create files in Shumai, either by uploading a local file or by providing the file name and content directly." |
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