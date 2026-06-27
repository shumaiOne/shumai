/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} UploadsInputs */

const en_uploads = /** @type {(inputs: UploadsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Uploads`)
};

const zh_uploads = /** @type {(inputs: UploadsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`上传管理`)
};

/**
* | output |
* | --- |
* | "Uploads" |
*
* @param {UploadsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const uploads = /** @type {((inputs?: UploadsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<UploadsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_uploads(inputs)
	return zh_uploads(inputs)
});