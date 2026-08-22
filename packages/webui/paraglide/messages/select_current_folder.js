/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Current_FolderInputs */

const en_select_current_folder = /** @type {(inputs: Select_Current_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select Current Folder`)
};

const zh_select_current_folder = /** @type {(inputs: Select_Current_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择当前文件夹`)
};

/**
* | output |
* | --- |
* | "Select Current Folder" |
*
* @param {Select_Current_FolderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_current_folder = /** @type {((inputs?: Select_Current_FolderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Current_FolderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_current_folder(inputs)
	return zh_select_current_folder(inputs)
});