/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} OrInputs */

const en_or = /** @type {(inputs: OrInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`OR`)
};

const zh_or = /** @type {(inputs: OrInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`或`)
};

/**
* | output |
* | --- |
* | "OR" |
*
* @param {OrInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const or = /** @type {((inputs?: OrInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<OrInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_or(inputs)
	return zh_or(inputs)
});