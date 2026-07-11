/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Global_ChatbotInputs */

const en_global_chatbot = /** @type {(inputs: Global_ChatbotInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Global Chatbot`)
};

const zh_global_chatbot = /** @type {(inputs: Global_ChatbotInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`全局聊天机器人`)
};

/**
* | output |
* | --- |
* | "Global Chatbot" |
*
* @param {Global_ChatbotInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const global_chatbot = /** @type {((inputs?: Global_ChatbotInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Global_ChatbotInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_global_chatbot(inputs)
	return zh_global_chatbot(inputs)
});