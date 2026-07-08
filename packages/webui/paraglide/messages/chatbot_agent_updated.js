/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Chatbot_Agent_UpdatedInputs */

const en_chatbot_agent_updated = /** @type {(inputs: Chatbot_Agent_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Chatbot agent updated`)
};

const zh_chatbot_agent_updated = /** @type {(inputs: Chatbot_Agent_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`聊天智能体已更新`)
};

/**
* | output |
* | --- |
* | "Chatbot agent updated" |
*
* @param {Chatbot_Agent_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chatbot_agent_updated = /** @type {((inputs?: Chatbot_Agent_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Chatbot_Agent_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_chatbot_agent_updated(inputs)
	return zh_chatbot_agent_updated(inputs)
});