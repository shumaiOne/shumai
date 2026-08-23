/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Folder_SelectedInputs */

const en_no_folder_selected = /** @type {(inputs: No_Folder_SelectedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No folder selected`)
};

const zh_no_folder_selected = /** @type {(inputs: No_Folder_SelectedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未选择文件夹`)
};

/**
* | output |
* | --- |
* | "No folder selected" |
*
* @param {No_Folder_SelectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_folder_selected = /** @type {((inputs?: No_Folder_SelectedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Folder_SelectedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_folder_selected(inputs)
	return zh_no_folder_selected(inputs)
});