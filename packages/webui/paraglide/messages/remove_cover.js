/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Remove_CoverInputs */

const en_remove_cover = /** @type {(inputs: Remove_CoverInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Remove Cover`)
};

const zh_remove_cover = /** @type {(inputs: Remove_CoverInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`移除封面`)
};

/**
* | output |
* | --- |
* | "Remove Cover" |
*
* @param {Remove_CoverInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const remove_cover = /** @type {((inputs?: Remove_CoverInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Remove_CoverInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_remove_cover(inputs)
	return zh_remove_cover(inputs)
});