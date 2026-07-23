/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} RoleInputs */

const en_role = /** @type {(inputs: RoleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Role`)
};

const zh_role = /** @type {(inputs: RoleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`角色`)
};

/**
* | output |
* | --- |
* | "Role" |
*
* @param {RoleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const role = /** @type {((inputs?: RoleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<RoleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_role(inputs)
	return zh_role(inputs)
});