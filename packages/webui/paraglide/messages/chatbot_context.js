/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Chatbot_ContextInputs */

const en_chatbot_context = /** @type {(inputs: Chatbot_ContextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Chatbot Context`)
};

const zh_chatbot_context = /** @type {(inputs: Chatbot_ContextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`聊天机器人上下文`)
};

/**
* | output |
* | --- |
* | "Chatbot Context" |
*
* @param {Chatbot_ContextInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chatbot_context = /** @type {((inputs?: Chatbot_ContextInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Chatbot_ContextInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_chatbot_context(inputs)
	return zh_chatbot_context(inputs)
});