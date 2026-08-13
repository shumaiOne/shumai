/**
* | output |
* | --- |
* | "Creation Context" |
*
* @param {Autofill_Source_Creation_ContextInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source_creation_context: ((inputs?: Autofill_Source_Creation_ContextInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Autofill_Source_Creation_ContextInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Autofill_Source_Creation_ContextInputs = {};
