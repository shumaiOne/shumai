/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Target_FolderInputs */

const en_target_folder = /** @type {(inputs: Target_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Target Folder`)
};

const zh_target_folder = /** @type {(inputs: Target_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`目标文件夹`)
};

/**
* | output |
* | --- |
* | "Target Folder" |
*
* @param {Target_FolderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const target_folder = /** @type {((inputs?: Target_FolderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Target_FolderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_target_folder(inputs)
	return zh_target_folder(inputs)
});