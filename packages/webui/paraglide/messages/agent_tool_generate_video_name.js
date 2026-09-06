/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tool_Generate_Video_NameInputs */

const en_agent_tool_generate_video_name = /** @type {(inputs: Agent_Tool_Generate_Video_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Generate Video`)
};

const zh_agent_tool_generate_video_name = /** @type {(inputs: Agent_Tool_Generate_Video_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`生成视频`)
};

/**
* | output |
* | --- |
* | "Generate Video" |
*
* @param {Agent_Tool_Generate_Video_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_generate_video_name = /** @type {((inputs?: Agent_Tool_Generate_Video_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Tool_Generate_Video_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tool_generate_video_name(inputs)
	return zh_agent_tool_generate_video_name(inputs)
});