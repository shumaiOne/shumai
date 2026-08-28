/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Change_Time_FormatInputs */

const en_change_time_format = /** @type {(inputs: Change_Time_FormatInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Change time format`)
};

const zh_change_time_format = /** @type {(inputs: Change_Time_FormatInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更改时间格式`)
};

/**
* | output |
* | --- |
* | "Change time format" |
*
* @param {Change_Time_FormatInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const change_time_format = /** @type {((inputs?: Change_Time_FormatInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Change_Time_FormatInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_change_time_format(inputs)
	return zh_change_time_format(inputs)
});