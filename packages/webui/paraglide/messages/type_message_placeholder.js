/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Type_Message_PlaceholderInputs */

const en_type_message_placeholder = /** @type {(inputs: Type_Message_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Type a message...`)
};

const zh_type_message_placeholder = /** @type {(inputs: Type_Message_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`输入消息...`)
};

/**
* | output |
* | --- |
* | "Type a message..." |
*
* @param {Type_Message_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const type_message_placeholder = /** @type {((inputs?: Type_Message_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Type_Message_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_type_message_placeholder(inputs)
	return zh_type_message_placeholder(inputs)
});