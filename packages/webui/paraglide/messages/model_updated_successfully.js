/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Model_Updated_SuccessfullyInputs */

const en_model_updated_successfully = /** @type {(inputs: Model_Updated_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Model updated successfully`)
};

const zh_model_updated_successfully = /** @type {(inputs: Model_Updated_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`模型更新成功`)
};

/**
* | output |
* | --- |
* | "Model updated successfully" |
*
* @param {Model_Updated_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_updated_successfully = /** @type {((inputs?: Model_Updated_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Model_Updated_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_model_updated_successfully(inputs)
	return zh_model_updated_successfully(inputs)
});