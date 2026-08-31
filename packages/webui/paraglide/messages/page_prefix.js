/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ page: NonNullable<unknown> }} Page_PrefixInputs */

const en_page_prefix = /** @type {(inputs: Page_PrefixInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Page ${i?.page}`)
};

const zh_page_prefix = /** @type {(inputs: Page_PrefixInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`第 ${i?.page} 页`)
};

/**
* | output |
* | --- |
* | "Page {page}" |
*
* @param {Page_PrefixInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const page_prefix = /** @type {((inputs: Page_PrefixInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Page_PrefixInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_page_prefix(inputs)
	return zh_page_prefix(inputs)
});