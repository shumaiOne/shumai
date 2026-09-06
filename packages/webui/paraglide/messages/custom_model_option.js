/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Custom_Model_OptionInputs */

const en_custom_model_option = /** @type {(inputs: Custom_Model_OptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Custom Model...`)
};

const zh_custom_model_option = /** @type {(inputs: Custom_Model_OptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`自定义模型...`)
};

/**
* | output |
* | --- |
* | "Custom Model..." |
*
* @param {Custom_Model_OptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const custom_model_option = /** @type {((inputs?: Custom_Model_OptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Custom_Model_OptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_custom_model_option(inputs)
	return zh_custom_model_option(inputs)
});