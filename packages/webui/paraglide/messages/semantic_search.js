/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Semantic_SearchInputs */

const en_semantic_search = /** @type {(inputs: Semantic_SearchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Semantic Search`)
};

const zh_semantic_search = /** @type {(inputs: Semantic_SearchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`语义搜索`)
};

/**
* | output |
* | --- |
* | "Semantic Search" |
*
* @param {Semantic_SearchInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const semantic_search = /** @type {((inputs?: Semantic_SearchInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Semantic_SearchInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_semantic_search(inputs)
	return zh_semantic_search(inputs)
});