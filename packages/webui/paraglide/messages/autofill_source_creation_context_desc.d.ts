/**
* | output |
* | --- |
* | "Fields marked as 'Creation Context' capture details available at creation time (such as generation prompt, model, or provider). If an asset is created by a S..." |
*
* @param {Autofill_Source_Creation_Context_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source_creation_context_desc: ((inputs?: Autofill_Source_Creation_Context_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Autofill_Source_Creation_Context_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Autofill_Source_Creation_Context_DescInputs = {};
