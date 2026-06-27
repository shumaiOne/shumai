/**
* | output |
* | --- |
* | "Generating embeddings..." |
*
* @param {Generating_EmbeddingsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const generating_embeddings: ((inputs?: Generating_EmbeddingsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Generating_EmbeddingsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Generating_EmbeddingsInputs = {};
