/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Remove_ModelInputs */

const en_failed_to_remove_model = /** @type {(inputs: Failed_To_Remove_ModelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to remove model`)
};

const zh_failed_to_remove_model = /** @type {(inputs: Failed_To_Remove_ModelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`移除模型失败`)
};

/**
* | output |
* | --- |
* | "Failed to remove model" |
*
* @param {Failed_To_Remove_ModelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_remove_model = /** @type {((inputs?: Failed_To_Remove_ModelInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Remove_ModelInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_remove_model(inputs)
	return zh_failed_to_remove_model(inputs)
});