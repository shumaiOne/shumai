/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Only_Zip_Files_SupportedInputs */

const en_only_zip_files_supported = /** @type {(inputs: Only_Zip_Files_SupportedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Only .zip files are supported.`)
};

const zh_only_zip_files_supported = /** @type {(inputs: Only_Zip_Files_SupportedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`仅支持 .zip 文件。`)
};

/**
* | output |
* | --- |
* | "Only .zip files are supported." |
*
* @param {Only_Zip_Files_SupportedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const only_zip_files_supported = /** @type {((inputs?: Only_Zip_Files_SupportedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Only_Zip_Files_SupportedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_only_zip_files_supported(inputs)
	return zh_only_zip_files_supported(inputs)
});