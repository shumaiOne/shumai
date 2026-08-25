/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Go_To_LoginInputs */

const en_go_to_login = /** @type {(inputs: Go_To_LoginInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Go to Login`)
};

const zh_go_to_login = /** @type {(inputs: Go_To_LoginInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`前往登录`)
};

/**
* | output |
* | --- |
* | "Go to Login" |
*
* @param {Go_To_LoginInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const go_to_login = /** @type {((inputs?: Go_To_LoginInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Go_To_LoginInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_go_to_login(inputs)
	return zh_go_to_login(inputs)
});