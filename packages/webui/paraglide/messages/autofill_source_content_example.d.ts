/**
* | output |
* | --- |
* | "Example: Image subject category, visual color palette, document summary, auto-detected language." |
*
* @param {Autofill_Source_Content_ExampleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source_content_example: ((inputs?: Autofill_Source_Content_ExampleInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Autofill_Source_Content_ExampleInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Autofill_Source_Content_ExampleInputs = {};
