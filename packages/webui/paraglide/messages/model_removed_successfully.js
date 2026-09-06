/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Model_Removed_SuccessfullyInputs */

const en_model_removed_successfully = /** @type {(inputs: Model_Removed_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Model removed successfully`)
};

const zh_model_removed_successfully = /** @type {(inputs: Model_Removed_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`模型移除成功`)
};

/**
* | output |
* | --- |
* | "Model removed successfully" |
*
* @param {Model_Removed_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_removed_successfully = /** @type {((inputs?: Model_Removed_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Model_Removed_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_model_removed_successfully(inputs)
	return zh_model_removed_successfully(inputs)
});