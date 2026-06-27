/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} UploadingInputs */

const en_uploading = /** @type {(inputs: UploadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Uploading...`)
};

const zh_uploading = /** @type {(inputs: UploadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`上传中...`)
};

/**
* | output |
* | --- |
* | "Uploading..." |
*
* @param {UploadingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const uploading = /** @type {((inputs?: UploadingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<UploadingInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_uploading(inputs)
	return zh_uploading(inputs)
});