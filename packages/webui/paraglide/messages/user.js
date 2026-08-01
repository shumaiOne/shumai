/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} UserInputs */

const en_user = /** @type {(inputs: UserInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`User`)
};

const zh_user = /** @type {(inputs: UserInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`用户`)
};

/**
* | output |
* | --- |
* | "User" |
*
* @param {UserInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const user = /** @type {((inputs?: UserInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<UserInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_user(inputs)
	return zh_user(inputs)
});