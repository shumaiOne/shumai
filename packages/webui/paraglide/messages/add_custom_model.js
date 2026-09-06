/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Custom_ModelInputs */

const en_add_custom_model = /** @type {(inputs: Add_Custom_ModelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add Custom Model`)
};

const zh_add_custom_model = /** @type {(inputs: Add_Custom_ModelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`添加自定义模型`)
};

/**
* | output |
* | --- |
* | "Add Custom Model" |
*
* @param {Add_Custom_ModelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_custom_model = /** @type {((inputs?: Add_Custom_ModelInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Custom_ModelInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_custom_model(inputs)
	return zh_add_custom_model(inputs)
});