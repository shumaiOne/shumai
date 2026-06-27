/**
* | output |
* | --- |
* | "Save Configuration" |
*
* @param {Save_ConfigurationInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const save_configuration: ((inputs?: Save_ConfigurationInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Save_ConfigurationInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Save_ConfigurationInputs = {};
