/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Ready_To_SearchInputs */

const en_ready_to_search = /** @type {(inputs: Ready_To_SearchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Ready to Search`)
};

const zh_ready_to_search = /** @type {(inputs: Ready_To_SearchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`准备搜索`)
};

/**
* | output |
* | --- |
* | "Ready to Search" |
*
* @param {Ready_To_SearchInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const ready_to_search = /** @type {((inputs?: Ready_To_SearchInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Ready_To_SearchInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_ready_to_search(inputs)
	return zh_ready_to_search(inputs)
});