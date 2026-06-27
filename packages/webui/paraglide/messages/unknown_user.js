/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Unknown_UserInputs */

const en_unknown_user = /** @type {(inputs: Unknown_UserInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Unknown User`)
};

const zh_unknown_user = /** @type {(inputs: Unknown_UserInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未知用户`)
};

/**
* | output |
* | --- |
* | "Unknown User" |
*
* @param {Unknown_UserInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const unknown_user = /** @type {((inputs?: Unknown_UserInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Unknown_UserInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_unknown_user(inputs)
	return zh_unknown_user(inputs)
});