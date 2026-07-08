/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Chatbot_SettingsInputs */

const en_chatbot_settings = /** @type {(inputs: Chatbot_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Chatbot Settings`)
};

const zh_chatbot_settings = /** @type {(inputs: Chatbot_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`聊天机器人设置`)
};

/**
* | output |
* | --- |
* | "Chatbot Settings" |
*
* @param {Chatbot_SettingsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chatbot_settings = /** @type {((inputs?: Chatbot_SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Chatbot_SettingsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_chatbot_settings(inputs)
	return zh_chatbot_settings(inputs)
});