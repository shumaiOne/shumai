/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Permission_All_UsersInputs */

const en_permission_all_users = /** @type {(inputs: Permission_All_UsersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`All Users`)
};

const zh_permission_all_users = /** @type {(inputs: Permission_All_UsersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`所有成员`)
};

/**
* | output |
* | --- |
* | "All Users" |
*
* @param {Permission_All_UsersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const permission_all_users = /** @type {((inputs?: Permission_All_UsersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Permission_All_UsersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_permission_all_users(inputs)
	return zh_permission_all_users(inputs)
});