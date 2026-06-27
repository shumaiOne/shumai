/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Upload_FileInputs */

const en_upload_file = /** @type {(inputs: Upload_FileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Upload File`)
};

const zh_upload_file = /** @type {(inputs: Upload_FileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`上传文件`)
};

/**
* | output |
* | --- |
* | "Upload File" |
*
* @param {Upload_FileInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const upload_file = /** @type {((inputs?: Upload_FileInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Upload_FileInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_upload_file(inputs)
	return zh_upload_file(inputs)
});