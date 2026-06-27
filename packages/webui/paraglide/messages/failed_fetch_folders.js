/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Fetch_FoldersInputs */

const en_failed_fetch_folders = /** @type {(inputs: Failed_Fetch_FoldersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to fetch folders`)
};

const zh_failed_fetch_folders = /** @type {(inputs: Failed_Fetch_FoldersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`获取文件夹失败`)
};

/**
* | output |
* | --- |
* | "Failed to fetch folders" |
*
* @param {Failed_Fetch_FoldersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_fetch_folders = /** @type {((inputs?: Failed_Fetch_FoldersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Fetch_FoldersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_fetch_folders(inputs)
	return zh_failed_fetch_folders(inputs)
});