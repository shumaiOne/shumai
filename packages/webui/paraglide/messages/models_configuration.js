/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Models_ConfigurationInputs */

const en_models_configuration = /** @type {(inputs: Models_ConfigurationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Models Configuration`)
};

const zh_models_configuration = /** @type {(inputs: Models_ConfigurationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`模型配置`)
};

/**
* | output |
* | --- |
* | "Models Configuration" |
*
* @param {Models_ConfigurationInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const models_configuration = /** @type {((inputs?: Models_ConfigurationInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Models_ConfigurationInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_models_configuration(inputs)
	return zh_models_configuration(inputs)
});