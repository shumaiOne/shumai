/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tool_Read_Asset_DescInputs */

const en_agent_tool_read_asset_desc = /** @type {(inputs: Agent_Tool_Read_Asset_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Allows the agent to view and inspect images, video frames, and document pages.`)
};

const zh_agent_tool_read_asset_desc = /** @type {(inputs: Agent_Tool_Read_Asset_DescInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`允许智能体查看和分析图片、视频画面和文档页面。`)
};

/**
* | output |
* | --- |
* | "Allows the agent to view and inspect images, video frames, and document pages." |
*
* @param {Agent_Tool_Read_Asset_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_read_asset_desc = /** @type {((inputs?: Agent_Tool_Read_Asset_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Tool_Read_Asset_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tool_read_asset_desc(inputs)
	return zh_agent_tool_read_asset_desc(inputs)
});