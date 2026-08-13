/**
* | output |
* | --- |
* | "Content" |
*
* @param {Autofill_Source_ContentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source_content: ((inputs?: Autofill_Source_ContentInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Autofill_Source_ContentInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Autofill_Source_ContentInputs = {};
