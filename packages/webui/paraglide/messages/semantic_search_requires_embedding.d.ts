/**
* | output |
* | --- |
* | "* Semantic search requires an enabled embedding agent." |
*
* @param {Semantic_Search_Requires_EmbeddingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const semantic_search_requires_embedding: ((inputs?: Semantic_Search_Requires_EmbeddingInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Semantic_Search_Requires_EmbeddingInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Semantic_Search_Requires_EmbeddingInputs = {};
