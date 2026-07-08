/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Configure_Chat_Agent_TooltipInputs */

const en_configure_chat_agent_tooltip = /** @type {(inputs: Configure_Chat_Agent_TooltipInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Please select a chat agent in settings first.`)
};

const zh_configure_chat_agent_tooltip = /** @type {(inputs: Configure_Chat_Agent_TooltipInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`请先在设置中选择聊天智能体。`)
};

/**
* | output |
* | --- |
* | "Please select a chat agent in settings first." |
*
* @param {Configure_Chat_Agent_TooltipInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const configure_chat_agent_tooltip = /** @type {((inputs?: Configure_Chat_Agent_TooltipInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Configure_Chat_Agent_TooltipInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_configure_chat_agent_tooltip(inputs)
	return zh_configure_chat_agent_tooltip(inputs)
});