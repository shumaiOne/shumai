/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Recent_FilesInputs */

const en_no_recent_files = /** @type {(inputs: No_Recent_FilesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No recently viewed files`)
};

const zh_no_recent_files = /** @type {(inputs: No_Recent_FilesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂无最近浏览文件`)
};

/**
* | output |
* | --- |
* | "No recently viewed files" |
*
* @param {No_Recent_FilesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_recent_files = /** @type {((inputs?: No_Recent_FilesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Recent_FilesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_recent_files(inputs)
	return zh_no_recent_files(inputs)
});