/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Configure_Chatbot_Agent_FirstInputs */

const en_configure_chatbot_agent_first = /** @type {(inputs: Configure_Chatbot_Agent_FirstInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Please configure a chatbot agent in team settings first.`)
};

const zh_configure_chatbot_agent_first = /** @type {(inputs: Configure_Chatbot_Agent_FirstInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`请先在团队设置中配置聊天机器人智能体。`)
};

/**
* | output |
* | --- |
* | "Please configure a chatbot agent in team settings first." |
*
* @param {Configure_Chatbot_Agent_FirstInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const configure_chatbot_agent_first = /** @type {((inputs?: Configure_Chatbot_Agent_FirstInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Configure_Chatbot_Agent_FirstInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_configure_chatbot_agent_first(inputs)
	return zh_configure_chatbot_agent_first(inputs)
});