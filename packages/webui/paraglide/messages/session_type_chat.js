/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Session_Type_ChatInputs */

const en_session_type_chat = /** @type {(inputs: Session_Type_ChatInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Chat`)
};

const zh_session_type_chat = /** @type {(inputs: Session_Type_ChatInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`对话`)
};

/**
* | output |
* | --- |
* | "Chat" |
*
* @param {Session_Type_ChatInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const session_type_chat = /** @type {((inputs?: Session_Type_ChatInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Session_Type_ChatInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_session_type_chat(inputs)
	return zh_session_type_chat(inputs)
});