/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Model_Id_PlaceholderInputs */

const en_model_id_placeholder = /** @type {(inputs: Model_Id_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`e.g., gpt-4o, claude-3-5-sonnet-20241022`)
};

const zh_model_id_placeholder = /** @type {(inputs: Model_Id_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`例如：gpt-4o, claude-3-5-sonnet-20241022`)
};

/**
* | output |
* | --- |
* | "e.g., gpt-4o, claude-3-5-sonnet-20241022" |
*
* @param {Model_Id_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_id_placeholder = /** @type {((inputs?: Model_Id_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Model_Id_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_model_id_placeholder(inputs)
	return zh_model_id_placeholder(inputs)
});