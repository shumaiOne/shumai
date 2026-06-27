/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Date_One_Week_From_NowInputs */

const en_date_one_week_from_now = /** @type {(inputs: Date_One_Week_From_NowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`One week from now`)
};

const zh_date_one_week_from_now = /** @type {(inputs: Date_One_Week_From_NowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`一周后`)
};

/**
* | output |
* | --- |
* | "One week from now" |
*
* @param {Date_One_Week_From_NowInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const date_one_week_from_now = /** @type {((inputs?: Date_One_Week_From_NowInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Date_One_Week_From_NowInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_date_one_week_from_now(inputs)
	return zh_date_one_week_from_now(inputs)
});