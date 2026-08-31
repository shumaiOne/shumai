/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Back_To_ChatInputs */

const en_back_to_chat = /** @type {(inputs: Back_To_ChatInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Back to Chat`)
};

const zh_back_to_chat = /** @type {(inputs: Back_To_ChatInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`返回聊天`)
};

/**
* | output |
* | --- |
* | "Back to Chat" |
*
* @param {Back_To_ChatInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const back_to_chat = /** @type {((inputs?: Back_To_ChatInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Back_To_ChatInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_back_to_chat(inputs)
	return zh_back_to_chat(inputs)
});