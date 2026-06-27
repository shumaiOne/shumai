/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ReviewerInputs */

const en_reviewer = /** @type {(inputs: ReviewerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Reviewer`)
};

const zh_reviewer = /** @type {(inputs: ReviewerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`审阅者`)
};

/**
* | output |
* | --- |
* | "Reviewer" |
*
* @param {ReviewerInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const reviewer = /** @type {((inputs?: ReviewerInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ReviewerInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_reviewer(inputs)
	return zh_reviewer(inputs)
});