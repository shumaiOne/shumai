/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} PreviousInputs */

const en_previous = /** @type {(inputs: PreviousInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Previous`)
};

const zh_previous = /** @type {(inputs: PreviousInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`上一页`)
};

/**
* | output |
* | --- |
* | "Previous" |
*
* @param {PreviousInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const previous = /** @type {((inputs?: PreviousInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<PreviousInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_previous(inputs)
	return zh_previous(inputs)
});