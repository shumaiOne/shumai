/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Delete_FolderInputs */

const en_failed_delete_folder = /** @type {(inputs: Failed_Delete_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to delete folder`)
};

const zh_failed_delete_folder = /** @type {(inputs: Failed_Delete_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除文件夹失败`)
};

/**
* | output |
* | --- |
* | "Failed to delete folder" |
*
* @param {Failed_Delete_FolderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_delete_folder = /** @type {((inputs?: Failed_Delete_FolderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Delete_FolderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_delete_folder(inputs)
	return zh_failed_delete_folder(inputs)
});