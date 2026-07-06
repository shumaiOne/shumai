/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Date_Format_LongInputs */

const en_date_format_long = /** @type {(inputs: Date_Format_LongInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`MMMM d, yyyy`)
};

const zh_date_format_long = /** @type {(inputs: Date_Format_LongInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`yyyy年M月d日`)
};

/**
* | output |
* | --- |
* | "MMMM d, yyyy" |
*
* @param {Date_Format_LongInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const date_format_long = /** @type {((inputs?: Date_Format_LongInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Date_Format_LongInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_date_format_long(inputs)
	return zh_date_format_long(inputs)
});