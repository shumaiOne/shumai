/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Model_Display_Name_PlaceholderInputs */

const en_model_display_name_placeholder = /** @type {(inputs: Model_Display_Name_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Friendly name for this model`)
};

const zh_model_display_name_placeholder = /** @type {(inputs: Model_Display_Name_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`该模型的易读名称`)
};

/**
* | output |
* | --- |
* | "Friendly name for this model" |
*
* @param {Model_Display_Name_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_display_name_placeholder = /** @type {((inputs?: Model_Display_Name_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Model_Display_Name_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_model_display_name_placeholder(inputs)
	return zh_model_display_name_placeholder(inputs)
});