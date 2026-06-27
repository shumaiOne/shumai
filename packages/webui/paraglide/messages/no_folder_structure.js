/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Folder_StructureInputs */

const en_no_folder_structure = /** @type {(inputs: No_Folder_StructureInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No Folder Structure`)
};

const zh_no_folder_structure = /** @type {(inputs: No_Folder_StructureInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`无文件夹结构`)
};

/**
* | output |
* | --- |
* | "No Folder Structure" |
*
* @param {No_Folder_StructureInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_folder_structure = /** @type {((inputs?: No_Folder_StructureInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Folder_StructureInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_folder_structure(inputs)
	return zh_no_folder_structure(inputs)
});