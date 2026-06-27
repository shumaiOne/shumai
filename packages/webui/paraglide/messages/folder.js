/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} FolderInputs */

const en_folder = /** @type {(inputs: FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Folder`)
};

const zh_folder = /** @type {(inputs: FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`文件夹`)
};

/**
* | output |
* | --- |
* | "Folder" |
*
* @param {FolderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const folder = /** @type {((inputs?: FolderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<FolderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_folder(inputs)
	return zh_folder(inputs)
});