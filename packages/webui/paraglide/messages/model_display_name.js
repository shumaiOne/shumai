/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Model_Display_NameInputs */

const en_model_display_name = /** @type {(inputs: Model_Display_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Display Name (Optional)`)
};

const zh_model_display_name = /** @type {(inputs: Model_Display_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`显示名称（可选）`)
};

/**
* | output |
* | --- |
* | "Display Name (Optional)" |
*
* @param {Model_Display_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_display_name = /** @type {((inputs?: Model_Display_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Model_Display_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_model_display_name(inputs)
	return zh_model_display_name(inputs)
});