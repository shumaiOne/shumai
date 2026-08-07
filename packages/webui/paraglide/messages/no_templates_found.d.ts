/**
* | output |
* | --- |
* | "No saved templates" |
*
* @param {No_Templates_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_templates_found: ((inputs?: No_Templates_FoundInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Templates_FoundInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Templates_FoundInputs = {};
