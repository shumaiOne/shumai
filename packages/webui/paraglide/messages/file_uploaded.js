/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} File_UploadedInputs */

const en_file_uploaded = /** @type {(inputs: File_UploadedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`File uploaded`)
};

const zh_file_uploaded = /** @type {(inputs: File_UploadedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`文件已上传`)
};

/**
* | output |
* | --- |
* | "File uploaded" |
*
* @param {File_UploadedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const file_uploaded = /** @type {((inputs?: File_UploadedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<File_UploadedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_file_uploaded(inputs)
	return zh_file_uploaded(inputs)
});