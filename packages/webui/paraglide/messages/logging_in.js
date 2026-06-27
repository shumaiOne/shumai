/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Logging_InInputs */

const en_logging_in = /** @type {(inputs: Logging_InInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Logging in...`)
};

const zh_logging_in = /** @type {(inputs: Logging_InInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`登录中...`)
};

/**
* | output |
* | --- |
* | "Logging in..." |
*
* @param {Logging_InInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const logging_in = /** @type {((inputs?: Logging_InInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Logging_InInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_logging_in(inputs)
	return zh_logging_in(inputs)
});