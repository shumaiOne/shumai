/**
* | output |
* | --- |
* | "Embedding" |
*
* @param {Agent_Type_EmbeddingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_type_embedding: ((inputs?: Agent_Type_EmbeddingInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Type_EmbeddingInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Type_EmbeddingInputs = {};
