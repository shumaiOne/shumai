/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Start_DownloadInputs */

const en_start_download = /** @type {(inputs: Start_DownloadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Start Download`)
};

const zh_start_download = /** @type {(inputs: Start_DownloadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`开始下载`)
};

/**
* | output |
* | --- |
* | "Start Download" |
*
* @param {Start_DownloadInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const start_download = /** @type {((inputs?: Start_DownloadInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Start_DownloadInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_start_download(inputs)
	return zh_start_download(inputs)
});