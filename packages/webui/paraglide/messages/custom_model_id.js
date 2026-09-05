/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Custom_Model_IdInputs */

const en_custom_model_id = /** @type {(inputs: Custom_Model_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Custom Model ID`)
};

const zh_custom_model_id = /** @type {(inputs: Custom_Model_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`自定义模型 ID`)
};

/**
* | output |
* | --- |
* | "Custom Model ID" |
*
* @param {Custom_Model_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const custom_model_id = /** @type {((inputs?: Custom_Model_IdInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Custom_Model_IdInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_custom_model_id(inputs)
	return zh_custom_model_id(inputs)
});