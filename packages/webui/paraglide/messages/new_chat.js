/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} New_ChatInputs */

const en_new_chat = /** @type {(inputs: New_ChatInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`New Chat`)
};

const zh_new_chat = /** @type {(inputs: New_ChatInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`开启新会话`)
};

/**
* | output |
* | --- |
* | "New Chat" |
*
* @param {New_ChatInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const new_chat = /** @type {((inputs?: New_ChatInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<New_ChatInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_new_chat(inputs)
	return zh_new_chat(inputs)
});