/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Enter_Custom_Model_IdInputs */

const en_enter_custom_model_id = /** @type {(inputs: Enter_Custom_Model_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enter custom model ID`)
};

const zh_enter_custom_model_id = /** @type {(inputs: Enter_Custom_Model_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`输入自定义模型 ID`)
};

/**
* | output |
* | --- |
* | "Enter custom model ID" |
*
* @param {Enter_Custom_Model_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enter_custom_model_id = /** @type {((inputs?: Enter_Custom_Model_IdInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Enter_Custom_Model_IdInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_enter_custom_model_id(inputs)
	return zh_enter_custom_model_id(inputs)
});