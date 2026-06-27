/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Update_ProfileInputs */

const en_failed_update_profile = /** @type {(inputs: Failed_Update_ProfileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to update profile`)
};

const zh_failed_update_profile = /** @type {(inputs: Failed_Update_ProfileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更新个人资料失败`)
};

/**
* | output |
* | --- |
* | "Failed to update profile" |
*
* @param {Failed_Update_ProfileInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_update_profile = /** @type {((inputs?: Failed_Update_ProfileInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Update_ProfileInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_update_profile(inputs)
	return zh_failed_update_profile(inputs)
});