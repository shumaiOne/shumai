/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Copy_Name_And_Download_LinkInputs */

const en_copy_name_and_download_link = /** @type {(inputs: Copy_Name_And_Download_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Copy name and download link`)
};

const zh_copy_name_and_download_link = /** @type {(inputs: Copy_Name_And_Download_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`复制名称和下载链接`)
};

/**
* | output |
* | --- |
* | "Copy name and download link" |
*
* @param {Copy_Name_And_Download_LinkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const copy_name_and_download_link = /** @type {((inputs?: Copy_Name_And_Download_LinkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Copy_Name_And_Download_LinkInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_copy_name_and_download_link(inputs)
	return zh_copy_name_and_download_link(inputs)
});