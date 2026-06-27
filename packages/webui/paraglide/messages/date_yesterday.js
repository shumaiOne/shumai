/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Date_YesterdayInputs */

const en_date_yesterday = /** @type {(inputs: Date_YesterdayInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Yesterday`)
};

const zh_date_yesterday = /** @type {(inputs: Date_YesterdayInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`昨天`)
};

/**
* | output |
* | --- |
* | "Yesterday" |
*
* @param {Date_YesterdayInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const date_yesterday = /** @type {((inputs?: Date_YesterdayInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Date_YesterdayInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_date_yesterday(inputs)
	return zh_date_yesterday(inputs)
});