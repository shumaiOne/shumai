/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Confirm_DownloadInputs */

const en_confirm_download = /** @type {(inputs: Confirm_DownloadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Confirm Download`)
};

const zh_confirm_download = /** @type {(inputs: Confirm_DownloadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`确认下载`)
};

/**
* | output |
* | --- |
* | "Confirm Download" |
*
* @param {Confirm_DownloadInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const confirm_download = /** @type {((inputs?: Confirm_DownloadInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Confirm_DownloadInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_confirm_download(inputs)
	return zh_confirm_download(inputs)
});