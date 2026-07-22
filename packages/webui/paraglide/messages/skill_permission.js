/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Skill_PermissionInputs */

const en_skill_permission = /** @type {(inputs: Skill_PermissionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Permission`)
};

const zh_skill_permission = /** @type {(inputs: Skill_PermissionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`权限`)
};

/**
* | output |
* | --- |
* | "Permission" |
*
* @param {Skill_PermissionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const skill_permission = /** @type {((inputs?: Skill_PermissionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Skill_PermissionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_skill_permission(inputs)
	return zh_skill_permission(inputs)
});