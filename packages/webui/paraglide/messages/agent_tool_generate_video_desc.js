/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tool_Generate_Video_DescInputs */

const en_agent_tool_generate_video_desc = /** @type {(inputs: Agent_Tool_Generate_Video_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Allows the agent to generate videos from text, images, or frame sequences using configured AI video models.`)
};

const zh_agent_tool_generate_video_desc = /** @type {(inputs: Agent_Tool_Generate_Video_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`允许智能体使用已配置的 AI 视频模型根据提示词、图片或首尾帧生成视频。`)
};

/**
* | output |
* | --- |
* | "Allows the agent to generate videos from text, images, or frame sequences using configured AI video models." |
*
* @param {Agent_Tool_Generate_Video_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_generate_video_desc = /** @type {((inputs?: Agent_Tool_Generate_Video_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Tool_Generate_Video_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tool_generate_video_desc(inputs)
	return zh_agent_tool_generate_video_desc(inputs)
});