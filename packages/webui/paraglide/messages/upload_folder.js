/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Upload_FolderInputs */

const en_upload_folder = /** @type {(inputs: Upload_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Upload Folder`)
};

const zh_upload_folder = /** @type {(inputs: Upload_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`上传文件夹`)
};

/**
* | output |
* | --- |
* | "Upload Folder" |
*
* @param {Upload_FolderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const upload_folder = /** @type {((inputs?: Upload_FolderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Upload_FolderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_upload_folder(inputs)
	return zh_upload_folder(inputs)
});