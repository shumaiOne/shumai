/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} FitInputs */

const en_fit = /** @type {(inputs: FitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Fit`)
};

const zh_fit = /** @type {(inputs: FitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`适应窗口`)
};

/**
* | output |
* | --- |
* | "Fit" |
*
* @param {FitInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const fit = /** @type {((inputs?: FitInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<FitInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_fit(inputs)
	return zh_fit(inputs)
});