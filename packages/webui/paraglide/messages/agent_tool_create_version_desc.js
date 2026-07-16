/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tool_Create_Version_DescInputs */

const en_agent_tool_create_version_desc = /** @type {(inputs: Agent_Tool_Create_Version_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Allows the agent to upload and stack a new version of an existing file in Shumai.`)
};

const zh_agent_tool_create_version_desc = /** @type {(inputs: Agent_Tool_Create_Version_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`允许智能体在 Shumai 中为已有文件上传并叠加新版本。`)
};

/**
* | output |
* | --- |
* | "Allows the agent to upload and stack a new version of an existing file in Shumai." |
*
* @param {Agent_Tool_Create_Version_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_create_version_desc = /** @type {((inputs?: Agent_Tool_Create_Version_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Tool_Create_Version_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tool_create_version_desc(inputs)
	return zh_agent_tool_create_version_desc(inputs)
});