/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} One_WeekInputs */

const en_one_week = /** @type {(inputs: One_WeekInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`1 Week`)
};

const zh_one_week = /** @type {(inputs: One_WeekInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`1 周`)
};

/**
* | output |
* | --- |
* | "1 Week" |
*
* @param {One_WeekInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const one_week = /** @type {((inputs?: One_WeekInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<One_WeekInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_one_week(inputs)
	return zh_one_week(inputs)
});