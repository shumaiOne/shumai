/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Model_Created_SuccessfullyInputs */

const en_model_created_successfully = /** @type {(inputs: Model_Created_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Model created successfully`)
};

const zh_model_created_successfully = /** @type {(inputs: Model_Created_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`模型创建成功`)
};

/**
* | output |
* | --- |
* | "Model created successfully" |
*
* @param {Model_Created_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_created_successfully = /** @type {((inputs?: Model_Created_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Model_Created_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_model_created_successfully(inputs)
	return zh_model_created_successfully(inputs)
});