/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Read_OnlyInputs */

const en_read_only = /** @type {(inputs: Read_OnlyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Read-only`)
};

const zh_read_only = /** @type {(inputs: Read_OnlyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`只读`)
};

/**
* | output |
* | --- |
* | "Read-only" |
*
* @param {Read_OnlyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const read_only = /** @type {((inputs?: Read_OnlyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Read_OnlyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_read_only(inputs)
	return zh_read_only(inputs)
});