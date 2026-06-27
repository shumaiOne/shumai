/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Rename_FolderInputs */

const en_failed_rename_folder = /** @type {(inputs: Failed_Rename_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to rename folder`)
};

const zh_failed_rename_folder = /** @type {(inputs: Failed_Rename_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`重命名文件夹失败`)
};

/**
* | output |
* | --- |
* | "Failed to rename folder" |
*
* @param {Failed_Rename_FolderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_rename_folder = /** @type {((inputs?: Failed_Rename_FolderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Rename_FolderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_rename_folder(inputs)
	return zh_failed_rename_folder(inputs)
});