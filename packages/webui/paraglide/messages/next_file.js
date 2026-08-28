/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Next_FileInputs */

const en_next_file = /** @type {(inputs: Next_FileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Next file`)
};

const zh_next_file = /** @type {(inputs: Next_FileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`下一个文件`)
};

/**
* | output |
* | --- |
* | "Next file" |
*
* @param {Next_FileInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const next_file = /** @type {((inputs?: Next_FileInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Next_FileInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_next_file(inputs)
	return zh_next_file(inputs)
});