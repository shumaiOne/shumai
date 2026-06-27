/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Source_FolderInputs */

const en_select_source_folder = /** @type {(inputs: Select_Source_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select Source Folder`)
};

const zh_select_source_folder = /** @type {(inputs: Select_Source_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择来源文件夹`)
};

/**
* | output |
* | --- |
* | "Select Source Folder" |
*
* @param {Select_Source_FolderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_source_folder = /** @type {((inputs?: Select_Source_FolderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Source_FolderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_source_folder(inputs)
	return zh_select_source_folder(inputs)
});