/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Upload_FileInputs */

const en_failed_upload_file = /** @type {(inputs: Failed_Upload_FileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to upload file`)
};

const zh_failed_upload_file = /** @type {(inputs: Failed_Upload_FileInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`上传文件失败`)
};

/**
* | output |
* | --- |
* | "Failed to upload file" |
*
* @param {Failed_Upload_FileInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_upload_file = /** @type {((inputs?: Failed_Upload_FileInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Upload_FileInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_upload_file(inputs)
	return zh_failed_upload_file(inputs)
});