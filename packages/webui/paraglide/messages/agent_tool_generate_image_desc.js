/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tool_Generate_Image_DescInputs */

const en_agent_tool_generate_image_desc = /** @type {(inputs: Agent_Tool_Generate_Image_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Allows the agent to generate images from prompts and reference images using configured AI image models.`)
};

const zh_agent_tool_generate_image_desc = /** @type {(inputs: Agent_Tool_Generate_Image_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`允许智能体使用已配置的 AI 图片模型根据提示词和参考图片生成图片。`)
};

/**
* | output |
* | --- |
* | "Allows the agent to generate images from prompts and reference images using configured AI image models." |
*
* @param {Agent_Tool_Generate_Image_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_generate_image_desc = /** @type {((inputs?: Agent_Tool_Generate_Image_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Tool_Generate_Image_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tool_generate_image_desc(inputs)
	return zh_agent_tool_generate_image_desc(inputs)
});