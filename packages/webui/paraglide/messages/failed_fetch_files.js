/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Fetch_FilesInputs */

const en_failed_fetch_files = /** @type {(inputs: Failed_Fetch_FilesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to fetch files`)
};

const zh_failed_fetch_files = /** @type {(inputs: Failed_Fetch_FilesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`获取文件失败`)
};

/**
* | output |
* | --- |
* | "Failed to fetch files" |
*
* @param {Failed_Fetch_FilesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_fetch_files = /** @type {((inputs?: Failed_Fetch_FilesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Fetch_FilesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_fetch_files(inputs)
	return zh_failed_fetch_files(inputs)
});