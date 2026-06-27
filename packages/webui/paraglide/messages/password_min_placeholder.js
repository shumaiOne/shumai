/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Password_Min_PlaceholderInputs */

const en_password_min_placeholder = /** @type {(inputs: Password_Min_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`At least 3 characters`)
};

const zh_password_min_placeholder = /** @type {(inputs: Password_Min_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`至少 3 个字符`)
};

/**
* | output |
* | --- |
* | "At least 3 characters" |
*
* @param {Password_Min_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const password_min_placeholder = /** @type {((inputs?: Password_Min_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Password_Min_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_password_min_placeholder(inputs)
	return zh_password_min_placeholder(inputs)
});