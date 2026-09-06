/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Add_ModelInputs */

const en_failed_to_add_model = /** @type {(inputs: Failed_To_Add_ModelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to add model`)
};

const zh_failed_to_add_model = /** @type {(inputs: Failed_To_Add_ModelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`添加模型失败`)
};

/**
* | output |
* | --- |
* | "Failed to add model" |
*
* @param {Failed_To_Add_ModelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_add_model = /** @type {((inputs?: Failed_To_Add_ModelInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Add_ModelInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_add_model(inputs)
	return zh_failed_to_add_model(inputs)
});