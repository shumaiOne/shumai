/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Standard_TimeInputs */

const en_standard_time = /** @type {(inputs: Standard_TimeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Standard Time`)
};

const zh_standard_time = /** @type {(inputs: Standard_TimeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`标准时间`)
};

/**
* | output |
* | --- |
* | "Standard Time" |
*
* @param {Standard_TimeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const standard_time = /** @type {((inputs?: Standard_TimeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Standard_TimeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_standard_time(inputs)
	return zh_standard_time(inputs)
});