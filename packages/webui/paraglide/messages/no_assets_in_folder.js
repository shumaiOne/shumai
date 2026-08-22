/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Assets_In_FolderInputs */

const en_no_assets_in_folder = /** @type {(inputs: No_Assets_In_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No assets in this folder`)
};

const zh_no_assets_in_folder = /** @type {(inputs: No_Assets_In_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`此文件夹中没有资产`)
};

/**
* | output |
* | --- |
* | "No assets in this folder" |
*
* @param {No_Assets_In_FolderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_assets_in_folder = /** @type {((inputs?: No_Assets_In_FolderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Assets_In_FolderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_assets_in_folder(inputs)
	return zh_no_assets_in_folder(inputs)
});