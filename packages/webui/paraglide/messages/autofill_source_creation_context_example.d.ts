/**
* | output |
* | --- |
* | "Example: Generation prompt, AI model name, LLM provider, sampler seed parameters." |
*
* @param {Autofill_Source_Creation_Context_ExampleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source_creation_context_example: ((inputs?: Autofill_Source_Creation_Context_ExampleInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Autofill_Source_Creation_Context_ExampleInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Autofill_Source_Creation_Context_ExampleInputs = {};
