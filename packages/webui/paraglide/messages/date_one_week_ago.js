/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Date_One_Week_AgoInputs */

const en_date_one_week_ago = /** @type {(inputs: Date_One_Week_AgoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`One week ago`)
};

const zh_date_one_week_ago = /** @type {(inputs: Date_One_Week_AgoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`一周前`)
};

/**
* | output |
* | --- |
* | "One week ago" |
*
* @param {Date_One_Week_AgoInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const date_one_week_ago = /** @type {((inputs?: Date_One_Week_AgoInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Date_One_Week_AgoInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_date_one_week_ago(inputs)
	return zh_date_one_week_ago(inputs)
});