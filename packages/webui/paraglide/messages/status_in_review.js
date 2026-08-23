/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Status_In_ReviewInputs */

const en_status_in_review = /** @type {(inputs: Status_In_ReviewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`In Review`)
};

const zh_status_in_review = /** @type {(inputs: Status_In_ReviewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`审核中`)
};

/**
* | output |
* | --- |
* | "In Review" |
*
* @param {Status_In_ReviewInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const status_in_review = /** @type {((inputs?: Status_In_ReviewInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Status_In_ReviewInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_status_in_review(inputs)
	return zh_status_in_review(inputs)
});