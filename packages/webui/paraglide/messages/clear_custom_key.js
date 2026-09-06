/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Clear_Custom_KeyInputs */

const en_clear_custom_key = /** @type {(inputs: Clear_Custom_KeyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Clear Custom Key`)
};

const zh_clear_custom_key = /** @type {(inputs: Clear_Custom_KeyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`清除自定义密钥`)
};

/**
* | output |
* | --- |
* | "Clear Custom Key" |
*
* @param {Clear_Custom_KeyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const clear_custom_key = /** @type {((inputs?: Clear_Custom_KeyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Clear_Custom_KeyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_clear_custom_key(inputs)
	return zh_clear_custom_key(inputs)
});