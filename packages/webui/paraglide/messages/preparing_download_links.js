/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Preparing_Download_LinksInputs */

const en_preparing_download_links = /** @type {(inputs: Preparing_Download_LinksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Preparing download links...`)
};

const zh_preparing_download_links = /** @type {(inputs: Preparing_Download_LinksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`正在准备下载链接...`)
};

/**
* | output |
* | --- |
* | "Preparing download links..." |
*
* @param {Preparing_Download_LinksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const preparing_download_links = /** @type {((inputs?: Preparing_Download_LinksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Preparing_Download_LinksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_preparing_download_links(inputs)
	return zh_preparing_download_links(inputs)
});