/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Two_WeeksInputs */

const en_two_weeks = /** @type {(inputs: Two_WeeksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`2 Weeks`)
};

const zh_two_weeks = /** @type {(inputs: Two_WeeksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`2 周`)
};

/**
* | output |
* | --- |
* | "2 Weeks" |
*
* @param {Two_WeeksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const two_weeks = /** @type {((inputs?: Two_WeeksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Two_WeeksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_two_weeks(inputs)
	return zh_two_weeks(inputs)
});