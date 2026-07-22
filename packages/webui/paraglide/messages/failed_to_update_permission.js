/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Update_PermissionInputs */

const en_failed_to_update_permission = /** @type {(inputs: Failed_To_Update_PermissionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to update permission`)
};

const zh_failed_to_update_permission = /** @type {(inputs: Failed_To_Update_PermissionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更新权限失败`)
};

/**
* | output |
* | --- |
* | "Failed to update permission" |
*
* @param {Failed_To_Update_PermissionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_update_permission = /** @type {((inputs?: Failed_To_Update_PermissionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Update_PermissionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_update_permission(inputs)
	return zh_failed_to_update_permission(inputs)
});