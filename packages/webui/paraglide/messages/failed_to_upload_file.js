/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown> }} Failed_To_Upload_FileInputs */

const en_failed_to_upload_file = /** @type {(inputs: Failed_To_Upload_FileInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Failed to upload file: ${i?.name}`)
};

const zh_failed_to_upload_file = /** @type {(inputs: Failed_To_Upload_FileInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`文件上传失败：${i?.name}`)
};

/**
* | output |
* | --- |
* | "Failed to upload file: {name}" |
*
* @param {Failed_To_Upload_FileInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_upload_file = /** @type {((inputs: Failed_To_Upload_FileInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Upload_FileInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_upload_file(inputs)
	return zh_failed_to_upload_file(inputs)
});