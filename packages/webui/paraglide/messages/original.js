/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} OriginalInputs */

const en_original = /** @type {(inputs: OriginalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Original`)
};

const zh_original = /** @type {(inputs: OriginalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`原始`)
};

/**
* | output |
* | --- |
* | "Original" |
*
* @param {OriginalInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const original = /** @type {((inputs?: OriginalInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<OriginalInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_original(inputs)
	return zh_original(inputs)
});