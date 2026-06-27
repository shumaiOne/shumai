/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} All_Downloads_InitiatedInputs */

const en_all_downloads_initiated = /** @type {(inputs: All_Downloads_InitiatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`All downloads initiated successfully`)
};

const zh_all_downloads_initiated = /** @type {(inputs: All_Downloads_InitiatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`所有下载已成功发起`)
};

/**
* | output |
* | --- |
* | "All downloads initiated successfully" |
*
* @param {All_Downloads_InitiatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const all_downloads_initiated = /** @type {((inputs?: All_Downloads_InitiatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<All_Downloads_InitiatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_all_downloads_initiated(inputs)
	return zh_all_downloads_initiated(inputs)
});