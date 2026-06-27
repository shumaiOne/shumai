/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Uploading_StatusInputs */

const en_uploading_status = /** @type {(inputs: Uploading_StatusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Uploading`)
};

const zh_uploading_status = /** @type {(inputs: Uploading_StatusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`上传中`)
};

/**
* | output |
* | --- |
* | "Uploading" |
*
* @param {Uploading_StatusInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const uploading_status = /** @type {((inputs?: Uploading_StatusInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Uploading_StatusInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_uploading_status(inputs)
	return zh_uploading_status(inputs)
});