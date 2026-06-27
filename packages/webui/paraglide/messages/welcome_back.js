/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Welcome_BackInputs */

const en_welcome_back = /** @type {(inputs: Welcome_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Welcome Back`)
};

const zh_welcome_back = /** @type {(inputs: Welcome_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`欢迎回来`)
};

/**
* | output |
* | --- |
* | "Welcome Back" |
*
* @param {Welcome_BackInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const welcome_back = /** @type {((inputs?: Welcome_BackInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Welcome_BackInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_welcome_back(inputs)
	return zh_welcome_back(inputs)
});