/**
* | output |
* | --- |
* | "Autofill Source Guide" |
*
* @param {Autofill_Source_Help_TitleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_source_help_title: ((inputs?: Autofill_Source_Help_TitleInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Autofill_Source_Help_TitleInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Autofill_Source_Help_TitleInputs = {};
