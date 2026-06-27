/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twenty_Four_HoursInputs */

const en_twenty_four_hours = /** @type {(inputs: Twenty_Four_HoursInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`24 Hours`)
};

const zh_twenty_four_hours = /** @type {(inputs: Twenty_Four_HoursInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`24 小时`)
};

/**
* | output |
* | --- |
* | "24 Hours" |
*
* @param {Twenty_Four_HoursInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const twenty_four_hours = /** @type {((inputs?: Twenty_Four_HoursInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twenty_Four_HoursInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twenty_four_hours(inputs)
	return zh_twenty_four_hours(inputs)
});