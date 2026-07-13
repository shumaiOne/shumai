/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Chatbot_AgentInputs */

const en_select_chatbot_agent = /** @type {(inputs: Select_Chatbot_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select chatbot agent`)
};

const zh_select_chatbot_agent = /** @type {(inputs: Select_Chatbot_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择聊天机器人智能体`)
};

/**
* | output |
* | --- |
* | "Select chatbot agent" |
*
* @param {Select_Chatbot_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_chatbot_agent = /** @type {((inputs?: Select_Chatbot_AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Chatbot_AgentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_chatbot_agent(inputs)
	return zh_select_chatbot_agent(inputs)
});