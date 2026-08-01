/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_UsersInputs */

const en_select_users = /** @type {(inputs: Select_UsersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select Users`)
};

const zh_select_users = /** @type {(inputs: Select_UsersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择用户`)
};

/**
* | output |
* | --- |
* | "Select Users" |
*
* @param {Select_UsersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_users = /** @type {((inputs?: Select_UsersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_UsersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_users(inputs)
	return zh_select_users(inputs)
});