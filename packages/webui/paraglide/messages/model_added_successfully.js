/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Model_Added_SuccessfullyInputs */

const en_model_added_successfully = /** @type {(inputs: Model_Added_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Model added successfully`)
};

const zh_model_added_successfully = /** @type {(inputs: Model_Added_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`模型添加成功`)
};

/**
* | output |
* | --- |
* | "Model added successfully" |
*
* @param {Model_Added_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_added_successfully = /** @type {((inputs?: Model_Added_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Model_Added_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_model_added_successfully(inputs)
	return zh_model_added_successfully(inputs)
});