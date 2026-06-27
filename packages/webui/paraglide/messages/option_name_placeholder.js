/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Option_Name_PlaceholderInputs */

const en_option_name_placeholder = /** @type {(inputs: Option_Name_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Option name`)
};

const zh_option_name_placeholder = /** @type {(inputs: Option_Name_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选项名称`)
};

/**
* | output |
* | --- |
* | "Option name" |
*
* @param {Option_Name_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const option_name_placeholder = /** @type {((inputs?: Option_Name_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Option_Name_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_option_name_placeholder(inputs)
	return zh_option_name_placeholder(inputs)
});