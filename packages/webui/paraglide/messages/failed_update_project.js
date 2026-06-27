/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Update_ProjectInputs */

const en_failed_update_project = /** @type {(inputs: Failed_Update_ProjectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to update project`)
};

const zh_failed_update_project = /** @type {(inputs: Failed_Update_ProjectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更新项目失败`)
};

/**
* | output |
* | --- |
* | "Failed to update project" |
*
* @param {Failed_Update_ProjectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_update_project = /** @type {((inputs?: Failed_Update_ProjectInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Update_ProjectInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_update_project(inputs)
	return zh_failed_update_project(inputs)
});