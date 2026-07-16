/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tool_Create_Folder_NameInputs */

const en_agent_tool_create_folder_name = /** @type {(inputs: Agent_Tool_Create_Folder_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create Folder`)
};

const zh_agent_tool_create_folder_name = /** @type {(inputs: Agent_Tool_Create_Folder_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创建文件夹`)
};

/**
* | output |
* | --- |
* | "Create Folder" |
*
* @param {Agent_Tool_Create_Folder_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_create_folder_name = /** @type {((inputs?: Agent_Tool_Create_Folder_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Tool_Create_Folder_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tool_create_folder_name(inputs)
	return zh_agent_tool_create_folder_name(inputs)
});