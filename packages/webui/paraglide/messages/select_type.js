/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_TypeInputs */

const en_select_type = /** @type {(inputs: Select_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select type`)
};

const zh_select_type = /** @type {(inputs: Select_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择类型`)
};

/**
* | output |
* | --- |
* | "Select type" |
*
* @param {Select_TypeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_type = /** @type {((inputs?: Select_TypeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_TypeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_type(inputs)
	return zh_select_type(inputs)
});