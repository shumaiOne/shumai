/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} File_Exceeds_1mb_LimitInputs */

const en_file_exceeds_1mb_limit = /** @type {(inputs: File_Exceeds_1mb_LimitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`File size exceeds the 1MB limit`)
};

const zh_file_exceeds_1mb_limit = /** @type {(inputs: File_Exceeds_1mb_LimitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`文件大小不能超过 1MB`)
};

/**
* | output |
* | --- |
* | "File size exceeds the 1MB limit" |
*
* @param {File_Exceeds_1mb_LimitInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const file_exceeds_1mb_limit = /** @type {((inputs?: File_Exceeds_1mb_LimitInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<File_Exceeds_1mb_LimitInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_file_exceeds_1mb_limit(inputs)
	return zh_file_exceeds_1mb_limit(inputs)
});