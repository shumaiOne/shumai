/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Set_RoleInputs */

const en_set_role = /** @type {(inputs: Set_RoleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Set Role`)
};

const zh_set_role = /** @type {(inputs: Set_RoleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`设置角色`)
};

/**
* | output |
* | --- |
* | "Set Role" |
*
* @param {Set_RoleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const set_role = /** @type {((inputs?: Set_RoleInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Set_RoleInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_set_role(inputs)
	return zh_set_role(inputs)
});