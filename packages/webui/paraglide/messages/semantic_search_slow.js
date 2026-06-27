/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Semantic_Search_SlowInputs */

const en_semantic_search_slow = /** @type {(inputs: Semantic_Search_SlowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Semantic search using media intelligence might be slow...`)
};

const zh_semantic_search_slow = /** @type {(inputs: Semantic_Search_SlowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`使用媒体智能的语义搜索可能较慢...`)
};

/**
* | output |
* | --- |
* | "Semantic search using media intelligence might be slow..." |
*
* @param {Semantic_Search_SlowInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const semantic_search_slow = /** @type {((inputs?: Semantic_Search_SlowInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Semantic_Search_SlowInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_semantic_search_slow(inputs)
	return zh_semantic_search_slow(inputs)
});