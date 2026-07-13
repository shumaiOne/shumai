/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ClearInputs */

const en_clear = /** @type {(inputs: ClearInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Clear`)
};

const zh_clear = /** @type {(inputs: ClearInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`清空`)
};

/**
* | output |
* | --- |
* | "Clear" |
*
* @param {ClearInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const clear = /** @type {((inputs?: ClearInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ClearInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_clear(inputs)
	return zh_clear(inputs)
});