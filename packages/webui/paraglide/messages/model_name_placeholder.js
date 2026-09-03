/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Model_Name_PlaceholderInputs */

const en_model_name_placeholder = /** @type {(inputs: Model_Name_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`e.g., GPT-4o`)
};

const zh_model_name_placeholder = /** @type {(inputs: Model_Name_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`例如：GPT-4o`)
};

/**
* | output |
* | --- |
* | "e.g., GPT-4o" |
*
* @param {Model_Name_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_name_placeholder = /** @type {((inputs?: Model_Name_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Model_Name_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_model_name_placeholder(inputs)
	return zh_model_name_placeholder(inputs)
});