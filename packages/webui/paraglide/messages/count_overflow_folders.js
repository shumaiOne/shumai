/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Count_Overflow_FoldersInputs */

const en_count_overflow_folders = /** @type {(inputs: Count_Overflow_FoldersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`10000+ Folders`)
};

const zh_count_overflow_folders = /** @type {(inputs: Count_Overflow_FoldersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`10000+ 文件夹`)
};

/**
* | output |
* | --- |
* | "10000+ Folders" |
*
* @param {Count_Overflow_FoldersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const count_overflow_folders = /** @type {((inputs?: Count_Overflow_FoldersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Count_Overflow_FoldersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_count_overflow_folders(inputs)
	return zh_count_overflow_folders(inputs)
});