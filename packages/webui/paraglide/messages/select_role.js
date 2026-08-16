/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_RoleInputs */

const en_select_role = /** @type {(inputs: Select_RoleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select Role`)
};

const zh_select_role = /** @type {(inputs: Select_RoleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择角色`)
};

/**
* | output |
* | --- |
* | "Select Role" |
*
* @param {Select_RoleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_role = /** @type {((inputs?: Select_RoleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_RoleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_role(inputs)
	return zh_select_role(inputs)
});