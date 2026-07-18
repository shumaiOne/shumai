/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Previous_PageInputs */

const en_previous_page = /** @type {(inputs: Previous_PageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Previous Page`)
};

const zh_previous_page = /** @type {(inputs: Previous_PageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`上一页`)
};

/**
* | output |
* | --- |
* | "Previous Page" |
*
* @param {Previous_PageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const previous_page = /** @type {((inputs?: Previous_PageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Previous_PageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_previous_page(inputs)
	return zh_previous_page(inputs)
});