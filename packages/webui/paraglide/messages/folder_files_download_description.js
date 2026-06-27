/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Folder_Files_Download_DescriptionInputs */

const en_folder_files_download_description = /** @type {(inputs: Folder_Files_Download_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Selected folder files will be prepared for download.`)
};

const zh_folder_files_download_description = /** @type {(inputs: Folder_Files_Download_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`所选文件夹中的文件将被准备下载。`)
};

/**
* | output |
* | --- |
* | "Selected folder files will be prepared for download." |
*
* @param {Folder_Files_Download_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const folder_files_download_description = /** @type {((inputs?: Folder_Files_Download_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Folder_Files_Download_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_folder_files_download_description(inputs)
	return zh_folder_files_download_description(inputs)
});