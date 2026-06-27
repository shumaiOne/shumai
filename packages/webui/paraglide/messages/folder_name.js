/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Folder_NameInputs */

const en_folder_name = /** @type {(inputs: Folder_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Folder name`)
};

const zh_folder_name = /** @type {(inputs: Folder_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`文件夹名称`)
};

/**
* | output |
* | --- |
* | "Folder name" |
*
* @param {Folder_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const folder_name = /** @type {((inputs?: Folder_NameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Folder_NameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_folder_name(inputs)
	return zh_folder_name(inputs)
});