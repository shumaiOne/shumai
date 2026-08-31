/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Type_A_MessageInputs */

const en_type_a_message = /** @type {(inputs: Type_A_MessageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Type a message...`)
};

const zh_type_a_message = /** @type {(inputs: Type_A_MessageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`输入消息...`)
};

/**
* | output |
* | --- |
* | "Type a message..." |
*
* @param {Type_A_MessageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const type_a_message = /** @type {((inputs?: Type_A_MessageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Type_A_MessageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_type_a_message(inputs)
	return zh_type_a_message(inputs)
});