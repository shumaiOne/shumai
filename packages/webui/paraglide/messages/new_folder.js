/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} New_FolderInputs */

const en_new_folder = /** @type {(inputs: New_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`New Folder`)
};

const zh_new_folder = /** @type {(inputs: New_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`新建文件夹`)
};

/**
* | output |
* | --- |
* | "New Folder" |
*
* @param {New_FolderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const new_folder = /** @type {((inputs?: New_FolderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<New_FolderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_new_folder(inputs)
	return zh_new_folder(inputs)
});