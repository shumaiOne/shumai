/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Hide_ChatbotInputs */

const en_hide_chatbot = /** @type {(inputs: Hide_ChatbotInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Hide Chatbot`)
};

const zh_hide_chatbot = /** @type {(inputs: Hide_ChatbotInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`隐藏聊天机器人`)
};

/**
* | output |
* | --- |
* | "Hide Chatbot" |
*
* @param {Hide_ChatbotInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hide_chatbot = /** @type {((inputs?: Hide_ChatbotInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hide_ChatbotInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_hide_chatbot(inputs)
	return zh_hide_chatbot(inputs)
});