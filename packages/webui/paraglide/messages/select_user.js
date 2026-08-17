/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_UserInputs */

const en_select_user = /** @type {(inputs: Select_UserInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select User`)
};

const zh_select_user = /** @type {(inputs: Select_UserInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择用户`)
};

/**
* | output |
* | --- |
* | "Select User" |
*
* @param {Select_UserInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_user = /** @type {((inputs?: Select_UserInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_UserInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_user(inputs)
	return zh_select_user(inputs)
});