/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Previous_FileInputs */

const en_previous_file = /** @type {(inputs: Previous_FileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Previous file`)
};

const zh_previous_file = /** @type {(inputs: Previous_FileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`上一个文件`)
};

/**
* | output |
* | --- |
* | "Previous file" |
*
* @param {Previous_FileInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const previous_file = /** @type {((inputs?: Previous_FileInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Previous_FileInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_previous_file(inputs)
	return zh_previous_file(inputs)
});