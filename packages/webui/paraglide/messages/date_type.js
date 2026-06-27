/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Date_TypeInputs */

const en_date_type = /** @type {(inputs: Date_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Date type`)
};

const zh_date_type = /** @type {(inputs: Date_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`日期类型`)
};

/**
* | output |
* | --- |
* | "Date type" |
*
* @param {Date_TypeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const date_type = /** @type {((inputs?: Date_TypeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Date_TypeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_date_type(inputs)
	return zh_date_type(inputs)
});