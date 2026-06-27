/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Upload_CoverInputs */

const en_upload_cover = /** @type {(inputs: Upload_CoverInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Upload cover`)
};

const zh_upload_cover = /** @type {(inputs: Upload_CoverInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`上传封面`)
};

/**
* | output |
* | --- |
* | "Upload cover" |
*
* @param {Upload_CoverInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const upload_cover = /** @type {((inputs?: Upload_CoverInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Upload_CoverInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_upload_cover(inputs)
	return zh_upload_cover(inputs)
});