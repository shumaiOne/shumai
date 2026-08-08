/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Allow_DownloadInputs */

const en_allow_download = /** @type {(inputs: Allow_DownloadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Allow download`)
};

const zh_allow_download = /** @type {(inputs: Allow_DownloadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`允许下载`)
};

/**
* | output |
* | --- |
* | "Allow download" |
*
* @param {Allow_DownloadInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const allow_download = /** @type {((inputs?: Allow_DownloadInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Allow_DownloadInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_allow_download(inputs)
	return zh_allow_download(inputs)
});