/**
* | output |
* | --- |
* | "Fields marked as 'Content' are automatically analyzed and extracted from the asset's visual or textual content after upload. Note: A team owner must first cr..." |
*
* @param {Autofill_Source_Content_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source_content_desc: ((inputs?: Autofill_Source_Content_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Autofill_Source_Content_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Autofill_Source_Content_DescInputs = {};
