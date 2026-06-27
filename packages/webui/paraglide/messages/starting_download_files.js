/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Starting_Download_FilesInputs */

const en_starting_download_files = /** @type {(inputs: Starting_Download_FilesInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Starting download of ${i?.count} files. Please allow multiple downloads if prompted by your browser.`)
};

const zh_starting_download_files = /** @type {(inputs: Starting_Download_FilesInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`正在开始下载 ${i?.count} 个文件。如果浏览器提示，请允许多个下载。`)
};

/**
* | output |
* | --- |
* | "Starting download of {count} files. Please allow multiple downloads if prompted by your browser." |
*
* @param {Starting_Download_FilesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const starting_download_files = /** @type {((inputs: Starting_Download_FilesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Starting_Download_FilesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_starting_download_files(inputs)
	return zh_starting_download_files(inputs)
});