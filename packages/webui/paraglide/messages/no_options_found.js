/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Options_FoundInputs */

const en_no_options_found = /** @type {(inputs: No_Options_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No options found`)
};

const zh_no_options_found = /** @type {(inputs: No_Options_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未找到选项`)
};

/**
* | output |
* | --- |
* | "No options found" |
*
* @param {No_Options_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_options_found = /** @type {((inputs?: No_Options_FoundInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Options_FoundInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_options_found(inputs)
	return zh_no_options_found(inputs)
});