/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Allow_Download_DescriptionInputs */

const en_allow_download_description = /** @type {(inputs: Allow_Download_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Visitors can download files from this share link`)
};

const zh_allow_download_description = /** @type {(inputs: Allow_Download_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`访客可以从该分享链接下载文件`)
};

/**
* | output |
* | --- |
* | "Visitors can download files from this share link" |
*
* @param {Allow_Download_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const allow_download_description = /** @type {((inputs?: Allow_Download_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Allow_Download_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_allow_download_description(inputs)
	return zh_allow_download_description(inputs)
});