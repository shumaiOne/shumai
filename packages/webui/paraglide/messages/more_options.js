/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} More_OptionsInputs */

const en_more_options = /** @type {(inputs: More_OptionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`More options`)
};

const zh_more_options = /** @type {(inputs: More_OptionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更多选项`)
};

/**
* | output |
* | --- |
* | "More options" |
*
* @param {More_OptionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const more_options = /** @type {((inputs?: More_OptionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<More_OptionsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_more_options(inputs)
	return zh_more_options(inputs)
});