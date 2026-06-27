/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Delete_Folder_ConfirmInputs */

const en_delete_folder_confirm = /** @type {(inputs: Delete_Folder_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete Folder?`)
};

const zh_delete_folder_confirm = /** @type {(inputs: Delete_Folder_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除文件夹？`)
};

/**
* | output |
* | --- |
* | "Delete Folder?" |
*
* @param {Delete_Folder_ConfirmInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_folder_confirm = /** @type {((inputs?: Delete_Folder_ConfirmInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Delete_Folder_ConfirmInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_delete_folder_confirm(inputs)
	return zh_delete_folder_confirm(inputs)
});