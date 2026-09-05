/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Model_TypeInputs */

const en_model_type = /** @type {(inputs: Model_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Model Type`)
};

const zh_model_type = /** @type {(inputs: Model_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`模型类型`)
};

/**
* | output |
* | --- |
* | "Model Type" |
*
* @param {Model_TypeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_type = /** @type {((inputs?: Model_TypeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Model_TypeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_model_type(inputs)
	return zh_model_type(inputs)
});