/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Recent_Files_DescriptionInputs */

const en_no_recent_files_description = /** @type {(inputs: No_Recent_Files_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Files you view in this project will appear here.`)
};

const zh_no_recent_files_description = /** @type {(inputs: No_Recent_Files_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`您在此项目中查看的文件将显示在此处。`)
};

/**
* | output |
* | --- |
* | "Files you view in this project will appear here." |
*
* @param {No_Recent_Files_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_recent_files_description = /** @type {((inputs?: No_Recent_Files_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Recent_Files_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_recent_files_description(inputs)
	return zh_no_recent_files_description(inputs)
});