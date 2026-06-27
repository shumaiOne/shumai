/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Go_To_FolderInputs */

const en_go_to_folder = /** @type {(inputs: Go_To_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Go to folder`)
};

const zh_go_to_folder = /** @type {(inputs: Go_To_FolderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`前往文件夹`)
};

/**
* | output |
* | --- |
* | "Go to folder" |
*
* @param {Go_To_FolderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const go_to_folder = /** @type {((inputs?: Go_To_FolderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Go_To_FolderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_go_to_folder(inputs)
	return zh_go_to_folder(inputs)
});