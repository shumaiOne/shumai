/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Remove_AvatarInputs */

const en_failed_remove_avatar = /** @type {(inputs: Failed_Remove_AvatarInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to remove avatar`)
};

const zh_failed_remove_avatar = /** @type {(inputs: Failed_Remove_AvatarInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`移除头像失败`)
};

/**
* | output |
* | --- |
* | "Failed to remove avatar" |
*
* @param {Failed_Remove_AvatarInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_remove_avatar = /** @type {((inputs?: Failed_Remove_AvatarInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Remove_AvatarInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_remove_avatar(inputs)
	return zh_failed_remove_avatar(inputs)
});