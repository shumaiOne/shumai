/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Chatbot_AgentInputs */

const en_chatbot_agent = /** @type {(inputs: Chatbot_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Default Chat Agent`)
};

const zh_chatbot_agent = /** @type {(inputs: Chatbot_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`默认聊天智能体`)
};

/**
* | output |
* | --- |
* | "Default Chat Agent" |
*
* @param {Chatbot_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chatbot_agent = /** @type {((inputs?: Chatbot_AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Chatbot_AgentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_chatbot_agent(inputs)
	return zh_chatbot_agent(inputs)
});