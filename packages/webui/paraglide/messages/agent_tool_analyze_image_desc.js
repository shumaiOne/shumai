/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tool_Analyze_Image_DescInputs */

const en_agent_tool_analyze_image_desc = /** @type {(inputs: Agent_Tool_Analyze_Image_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Allows the agent to view and analyze the visual contents of an image file.`)
};

const zh_agent_tool_analyze_image_desc = /** @type {(inputs: Agent_Tool_Analyze_Image_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`允许智能体查看和分析图片文件的视觉内容。`)
};

/**
* | output |
* | --- |
* | "Allows the agent to view and analyze the visual contents of an image file." |
*
* @param {Agent_Tool_Analyze_Image_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_analyze_image_desc = /** @type {((inputs?: Agent_Tool_Analyze_Image_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Tool_Analyze_Image_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tool_analyze_image_desc(inputs)
	return zh_agent_tool_analyze_image_desc(inputs)
});