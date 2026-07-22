/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Permission_Owner_OnlyInputs */

const en_permission_owner_only = /** @type {(inputs: Permission_Owner_OnlyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Owner Only`)
};

const zh_permission_owner_only = /** @type {(inputs: Permission_Owner_OnlyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`仅管理员`)
};

/**
* | output |
* | --- |
* | "Owner Only" |
*
* @param {Permission_Owner_OnlyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const permission_owner_only = /** @type {((inputs?: Permission_Owner_OnlyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Permission_Owner_OnlyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_permission_owner_only(inputs)
	return zh_permission_owner_only(inputs)
});