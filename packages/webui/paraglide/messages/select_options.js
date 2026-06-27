/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_OptionsInputs */

const en_select_options = /** @type {(inputs: Select_OptionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select options...`)
};

const zh_select_options = /** @type {(inputs: Select_OptionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择选项...`)
};

/**
* | output |
* | --- |
* | "Select options..." |
*
* @param {Select_OptionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_options = /** @type {((inputs?: Select_OptionsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_OptionsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_options(inputs)
	return zh_select_options(inputs)
});