/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Next_PageInputs */

const en_next_page = /** @type {(inputs: Next_PageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Next Page`)
};

const zh_next_page = /** @type {(inputs: Next_PageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`下一页`)
};

/**
* | output |
* | --- |
* | "Next Page" |
*
* @param {Next_PageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const next_page = /** @type {((inputs?: Next_PageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Next_PageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_next_page(inputs)
	return zh_next_page(inputs)
});