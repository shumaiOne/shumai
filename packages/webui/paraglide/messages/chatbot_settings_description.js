/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Chatbot_Settings_DescriptionInputs */

const en_chatbot_settings_description = /** @type {(inputs: Chatbot_Settings_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Choose which AI agent you want to chat with.`)
};

const zh_chatbot_settings_description = /** @type {(inputs: Chatbot_Settings_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择您想要对话的 AI 智能体。`)
};

/**
* | output |
* | --- |
* | "Choose which AI agent you want to chat with." |
*
* @param {Chatbot_Settings_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chatbot_settings_description = /** @type {((inputs?: Chatbot_Settings_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Chatbot_Settings_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_chatbot_settings_description(inputs)
	return zh_chatbot_settings_description(inputs)
});