/**
* | output |
* | --- |
* | "Select your preferred display language." |
*
* @param {Select_Preferred_LanguageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_preferred_language: ((inputs?: Select_Preferred_LanguageInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Select_Preferred_LanguageInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Select_Preferred_LanguageInputs = {};
