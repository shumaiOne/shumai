/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Package_UploadInputs */

const en_package_upload = /** @type {(inputs: Package_UploadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Package Upload`)
};

const zh_package_upload = /** @type {(inputs: Package_UploadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`包上传`)
};

/**
* | output |
* | --- |
* | "Package Upload" |
*
* @param {Package_UploadInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const package_upload = /** @type {((inputs?: Package_UploadInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Package_UploadInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_package_upload(inputs)
	return zh_package_upload(inputs)
});