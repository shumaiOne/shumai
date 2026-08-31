/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Open_File_To_Add_MarkupInputs */

const en_open_file_to_add_markup = /** @type {(inputs: Open_File_To_Add_MarkupInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Open a supported file to add markup`)
};

const zh_open_file_to_add_markup = /** @type {(inputs: Open_File_To_Add_MarkupInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`打开支持的文件以添加标注`)
};

/**
* | output |
* | --- |
* | "Open a supported file to add markup" |
*
* @param {Open_File_To_Add_MarkupInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const open_file_to_add_markup = /** @type {((inputs?: Open_File_To_Add_MarkupInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Open_File_To_Add_MarkupInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_open_file_to_add_markup(inputs)
	return zh_open_file_to_add_markup(inputs)
});