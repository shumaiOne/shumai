/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Fetch_Folder_ChildrenInputs */

const en_failed_to_fetch_folder_children = /** @type {(inputs: Failed_To_Fetch_Folder_ChildrenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to fetch folder children`)
};

const zh_failed_to_fetch_folder_children = /** @type {(inputs: Failed_To_Fetch_Folder_ChildrenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`获取子文件夹失败`)
};

/**
* | output |
* | --- |
* | "Failed to fetch folder children" |
*
* @param {Failed_To_Fetch_Folder_ChildrenInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_fetch_folder_children = /** @type {((inputs?: Failed_To_Fetch_Folder_ChildrenInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Fetch_Folder_ChildrenInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_fetch_folder_children(inputs)
	return zh_failed_to_fetch_folder_children(inputs)
});