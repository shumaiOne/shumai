/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Tool_Screenshot_NameInputs */

const en_agent_tool_screenshot_name = /** @type {(inputs: Agent_Tool_Screenshot_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Video Frame Extraction`)
};

const zh_agent_tool_screenshot_name = /** @type {(inputs: Agent_Tool_Screenshot_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`提取视频帧`)
};

/**
* | output |
* | --- |
* | "Video Frame Extraction" |
*
* @param {Agent_Tool_Screenshot_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_screenshot_name = /** @type {((inputs?: Agent_Tool_Screenshot_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Tool_Screenshot_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_tool_screenshot_name(inputs)
	return zh_agent_tool_screenshot_name(inputs)
});