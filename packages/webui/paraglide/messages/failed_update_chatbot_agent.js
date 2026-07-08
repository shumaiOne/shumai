/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Update_Chatbot_AgentInputs */

const en_failed_update_chatbot_agent = /** @type {(inputs: Failed_Update_Chatbot_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to update chatbot agent`)
};

const zh_failed_update_chatbot_agent = /** @type {(inputs: Failed_Update_Chatbot_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更新聊天智能体失败`)
};

/**
* | output |
* | --- |
* | "Failed to update chatbot agent" |
*
* @param {Failed_Update_Chatbot_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_update_chatbot_agent = /** @type {((inputs?: Failed_Update_Chatbot_AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Update_Chatbot_AgentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_update_chatbot_agent(inputs)
	return zh_failed_update_chatbot_agent(inputs)
});