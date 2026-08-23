/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Target_FolderInputs */

const en_select_target_folder = /** @type {(inputs: Select_Target_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select Target Folder`)
};

const zh_select_target_folder = /** @type {(inputs: Select_Target_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择目标文件夹`)
};

/**
* | output |
* | --- |
* | "Select Target Folder" |
*
* @param {Select_Target_FolderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_target_folder = /** @type {((inputs?: Select_Target_FolderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Target_FolderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_target_folder(inputs)
	return zh_select_target_folder(inputs)
});