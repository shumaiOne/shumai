/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Show_ChatbotInputs */

const en_show_chatbot = /** @type {(inputs: Show_ChatbotInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Show Chatbot`)
};

const zh_show_chatbot = /** @type {(inputs: Show_ChatbotInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`显示聊天机器人`)
};

/**
* | output |
* | --- |
* | "Show Chatbot" |
*
* @param {Show_ChatbotInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const show_chatbot = /** @type {((inputs?: Show_ChatbotInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Show_ChatbotInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_show_chatbot(inputs)
	return zh_show_chatbot(inputs)
});