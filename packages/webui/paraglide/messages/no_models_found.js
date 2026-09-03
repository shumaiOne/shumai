/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Models_FoundInputs */

const en_no_models_found = /** @type {(inputs: No_Models_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No models found`)
};

const zh_no_models_found = /** @type {(inputs: No_Models_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未找到模型`)
};

/**
* | output |
* | --- |
* | "No models found" |
*
* @param {No_Models_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_models_found = /** @type {((inputs?: No_Models_FoundInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Models_FoundInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_models_found(inputs)
	return zh_no_models_found(inputs)
});