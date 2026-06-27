/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Untitled_UploadInputs */

const en_untitled_upload = /** @type {(inputs: Untitled_UploadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Untitled Upload`)
};

const zh_untitled_upload = /** @type {(inputs: Untitled_UploadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未命名上传`)
};

/**
* | output |
* | --- |
* | "Untitled Upload" |
*
* @param {Untitled_UploadInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const untitled_upload = /** @type {((inputs?: Untitled_UploadInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Untitled_UploadInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_untitled_upload(inputs)
	return zh_untitled_upload(inputs)
});