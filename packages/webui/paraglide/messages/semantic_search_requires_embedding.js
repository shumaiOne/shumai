/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Semantic_Search_Requires_EmbeddingInputs */

const en_semantic_search_requires_embedding = /** @type {(inputs: Semantic_Search_Requires_EmbeddingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`* Semantic search requires an enabled embedding agent.`)
};

const zh_semantic_search_requires_embedding = /** @type {(inputs: Semantic_Search_Requires_EmbeddingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`* 语义搜索需要启用嵌入智能体。`)
};

/**
* | output |
* | --- |
* | "* Semantic search requires an enabled embedding agent." |
*
* @param {Semantic_Search_Requires_EmbeddingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const semantic_search_requires_embedding = /** @type {((inputs?: Semantic_Search_Requires_EmbeddingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Semantic_Search_Requires_EmbeddingInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_semantic_search_requires_embedding(inputs)
	return zh_semantic_search_requires_embedding(inputs)
});